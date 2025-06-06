import { siteData, groupColors } from './siteData.js';

function updateURLParams(params) {
  const url = new URL(window.location);
  Object.entries(params).forEach(([key, val]) => {
    if (val) {
      url.searchParams.set(key, val);
    } else {
      url.searchParams.delete(key);
    }
  });
  history.replaceState({}, '', url);
}

const states = ['MT','ID','CO','OR','WA'];

const stateNames = {
  MT: 'Montana',
  ID: 'Idaho',
  CO: 'Colorado',
  OR: 'Oregon',
  WA: 'Washington', 
};

const stateColors = {
  WA: '#0c4f3e',
  OR: '#5c9e88',
  ID: '#e17c58',
  MT: '#db9e37',
  CO: '#e67638'
};


import {
  getCurrentFlow,
  checkDataAvailability,
  fetch7DayData,
  fetchYearData
} from './usgs.js';

async function loadFishingReports() {
  const res = await fetch('js/fishing_reports.json');
  return await res.json();
}

const mapCenter = [47.4, -121.7];
const mapZoom = 8;

let siteId = siteData[0].id;
let siteName = siteData[0].name;
let flowChart = null;
let yearChart = null;

function updateCurrentStats({ flow, waterTemp, airTemp }, name) {
  const flowText = flow ? `${Math.round(flow).toLocaleString()} CFS` : 'Unavailable';
  const wtF = waterTemp ? `${waterTemp.toFixed(1)}°F` : 'N/A';
  const wtC = waterTemp ? `${((waterTemp - 32) * 5 / 9).toFixed(1)}°C` : 'N/A';
  const atF = airTemp ? `${airTemp.toFixed(1)}°F` : 'N/A';
  const atC = airTemp ? `${((airTemp - 32) * 5 / 9).toFixed(1)}°C` : 'N/A';
  document.getElementById('currentFlow').innerHTML = `
    <strong>${name}</strong><br>
    Flow: ${flowText}<br>
    Water Temp: ${wtF} / ${wtC}<br>
    Air Temp: ${atF} / ${atC}`;
}

function createStateButtons(containerId, onStateSelect) {
  const container = document.getElementById(containerId);
  let activeBtn = null;

  states.forEach(state => {
    const btn = document.createElement('button');
    btn.textContent = stateNames[state];
    btn.classList.add('state-button');
    btn.style = `
      background-color: white;
      color: black;
      border: 2px solid #555;
      border-radius: 999px;
      margin: 0.25rem;
      padding: 0.5rem 1.25rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 1rem;
      transition: all 0.2s ease-in-out;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    `;

    btn.onclick = () => {
      updateURLParams({ state, group: null });
    
      if (activeBtn) {
        activeBtn.style.backgroundColor = 'white';
        activeBtn.style.outline = 'none';
        activeBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
      }
      btn.style.backgroundColor = '#ddd';
      btn.style.outline = '2px solid #444';
      btn.style.boxShadow = '0 0 8px #888';
      activeBtn = btn;
    
      // Regenerate river buttons
      document.getElementById('filter-buttons').innerHTML = '';
      createFilterButtons('filter-buttons', handleFilterSelection, state);
    
      // Filter map markers by state
      const markersForState = markers.filter(({ data }) => data.state === state);
      markers.forEach(({ marker }) => map.removeLayer(marker));
      markersForState.forEach(({ marker }) => marker.addTo(map));
    
      // Fit map to state bounds
      if (markersForState.length) {
        const bounds = L.latLngBounds(markersForState.map(({ data }) => [data.lat, data.lng]));
        map.fitBounds(bounds);
      }
    
      // Clear fishing report and current stats with friendly prompt
      document.getElementById('river-summary').innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100%; text-align: center;">
          <p style="font-size: 1.2rem; font-weight: 300; padding: 2rem;">
            Select a river above to view a fishing report and current flow data.
          </p>
        </div>
      `;
      document.getElementById('currentFlow').innerHTML = `Select a river below to see current flow data.`;
    
      // Clear charts
      hide7DayChart();
    };
    

    container.appendChild(btn);
  });
}


function createFilterButtons(containerId, onFilterSelect, stateFilter = null) {
  const container = document.getElementById(containerId);
  let activeButton = null;

  const groupsByState = {};
  siteData.forEach(site => {
    if (!groupsByState[site.state]) groupsByState[site.state] = new Set();
    groupsByState[site.state].add(site.group);
  });

  const allBtn = document.createElement('button');
  allBtn.textContent = 'All';
  allBtn.classList.add('filter-button');
  allBtn.dataset.group = 'All';
  allBtn.style = buttonStyle('#333', '#fff', '#555');

  allBtn.onclick = () => {
    if (activeButton) resetButtonStyle(activeButton);
    allBtn.style = buttonStyle('#333', '#fff', '#555', true);
    activeButton = allBtn;
    updateURLParams({ group: null });
    onFilterSelect('All');
  };

  container.appendChild(allBtn);
  activeButton = allBtn;

  // Get all unique groups for the selected state(s)
  let groups = [];
  siteData.forEach(site => {
    if (!stateFilter || site.state === stateFilter) {
      if (!groups.includes(site.group)) groups.push(site.group);
    }
  });

  groups.sort().forEach(group => {
    const btn = document.createElement('button');
  
    // Get the state color for the group
    const site = siteData.find(s => s.group === group);
    const markerColor = site ? stateColors[site.state] : '#555';
  
    // Use contrasting text color for accessibility
    const isLight = isLightColor(markerColor);
    const textColor = isLight ? '#000' : '#fff';
  
    btn.textContent = group;
    btn.classList.add('filter-button');
    btn.dataset.group = group;
    btn.style = buttonStyle(markerColor, textColor, markerColor);
  
    btn.onclick = () => {
      if (activeButton) resetButtonStyle(activeButton);
      btn.style = buttonStyle(`${markerColor}11`, '#000', markerColor, true);
      activeButton = btn;
      updateURLParams({ group });
      onFilterSelect(group);
    };
  
    container.appendChild(btn);
  });
  
  function isLightColor(hex) {
    if (!hex || hex.length < 7) return false;
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 180; // Adjust threshold if needed
  }
  

  function buttonStyle(bg, text, border, active = false) {
    return `
      background-color: ${bg};
      color: ${text};
      border: 2px solid ${border};
      border-radius: 999px;
      margin: 0.25rem;
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.95rem;
      transition: all 0.2s ease-in-out;
      box-shadow: ${active ? `0 0 8px ${border}` : '0 1px 2px rgba(0,0,0,0.1)'};
      outline: ${active ? '2px solid #444' : 'none'};
    `;
  }

  function resetButtonStyle(btn) {
    const site = siteData.find(s => s.group === btn.dataset.group);
    const color = site ? stateColors[site.state] : '#555';
    const textColor = isLightColor(color) ? '#000' : '#fff';
    btn.style = buttonStyle(color, textColor, color);
  }
  
}


function selectFilterButtonForGroup(group) {
  const buttons = document.querySelectorAll('#filter-buttons .filter-button');
  buttons.forEach(btn => {
    const isMatch = btn.dataset.group === group;

    const site = siteData.find(s => s.group === btn.dataset.group);
    const color = site ? stateColors[site.state] : '#555';
    const isYellowish = color.toLowerCase() === '#f4b93a';
    const textColor = isYellowish ? '#000' : color;

    if (isMatch) {
      // Selected button
      btn.style = buttonStyle(`${color}11`, '#000', color, true); // force text color to black
    } else {
      // Default button style
      btn.style = buttonStyle('#fff', textColor, color);
    }
  });
}


async function loadReportOnly(group) {
  const summaryContainer = document.getElementById('river-summary');
  try {
    const reportsByKey = await loadFishingReports();

    // Flatten all reports from all keys into one array
    const allReports = Object.values(reportsByKey).flat();

    // Try to find a report whose river name matches the group
    const report = allReports.find(r => r.river.toLowerCase() === group.toLowerCase());

    if (report) {
      summaryContainer.innerHTML = `
        <h3>Fishing Report: ${report.river} River</h3>
        <div style="text-align: left; margin-bottom: 1rem;">${marked.parse(report.summary)}</div>
        <p style="font-size: 0.9rem; text-align: left;">
          <strong>Sources:</strong><br>
          ${report.sources.map(s => `<a href="${s.url}" target="_blank">${s.title}</a>`).join('<br>')}
        </p>
        <p style="font-size: 0.8rem; text-align: right;">Last updated: ${report.lastUpdated}</p>
      `;
    } else {
      summaryContainer.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100%; text-align: center;">
          <p style="font-size: 1.2rem; font-weight: 300; padding: 2rem;">
            No fishing report currently available for this river.
          </p>
        </div>
      `;
    }
  } catch (error) {
    summaryContainer.textContent = 'Error loading fishing report.';
    console.error('Error loading report:', error);
  }
}

async function handleFilterSelection(group) {
  // Filter visible sites in the group
  const visible = siteData.filter(site => group === 'All' || site.group === group);

  const sitesWithData = [];
  for (const site of visible) {
    const hasData = await checkDataAvailability(site.id);
    if (hasData) sitesWithData.push(site);
  }

  // Update map markers
  markers.forEach(({ marker, data }) => {
    if (sitesWithData.some(s => s.id === data.id)) {
      marker.addTo(map);
    } else {
      map.removeLayer(marker);
    }
  });

  // Fit map to bounds
  if (sitesWithData.length > 0) {
    if (sitesWithData.length === 1) {
      map.setView([sitesWithData[0].lat, sitesWithData[0].lng], 11);
    } else {
      const bounds = L.latLngBounds(sitesWithData.map(s => [s.lat, s.lng]));
      map.fitBounds(bounds);
    }
  }

  // If "All" is selected, show default message and exit
  if (group === 'All') {
    document.getElementById('river-summary').innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100%; text-align: center;">
        <p style="font-size: 1.2rem; font-weight: 300; padding: 2rem;">
          Select a river at the top of the page to view a fishing report summary from trusted local fly shops and guide services.
        </p>
      </div>
    `;
    showChartPlaceholders();
    return;
  }

  await loadReportOnly(group);

  // Show charts only for the first valid site with data
  if (sitesWithData.length > 0) {
    const defaultSite = sitesWithData[0];
    siteId = defaultSite.id;
    siteName = defaultSite.name;
    const readings = await getCurrentFlow(siteId);
    updateCurrentStats(readings, siteName);
    flowChart = await fetch7DayData(siteId, siteName, flowChart);
    yearChart = await fetchYearData(siteId, siteName, yearChart);
    showCharts();
  } else {
    showChartPlaceholders();
  }
}



function showChartPlaceholders() {
  document.getElementById('yakimaFlowChart').style.display = 'none';
  document.getElementById('sevenDayPrompt').style.display = 'block';

  document.getElementById('yakimaYearChart').style.display = 'none';
  document.getElementById('yearPrompt').style.display = 'block';

  // Clear the titles!
  document.getElementById('sevenDayTitle').textContent = '';
  document.getElementById('yearTitle').textContent = '';
}


function showCharts() {
  document.getElementById('yakimaFlowChart').style.display = 'block';
  document.getElementById('sevenDayPrompt').style.display = 'none';

  document.getElementById('yakimaYearChart').style.display = 'block';
  document.getElementById('yearPrompt').style.display = 'none';
}

function hide7DayChart() {
  document.getElementById('yakimaFlowChart').style.display = 'none';
  document.getElementById('sevenDayPrompt').style.display = 'block';

  // Either show a generic title or clear it entirely
  document.getElementById('sevenDayTitle').textContent = '';
}

async function updateChartsForSite(site) {
  // Update global site variables
  siteId = site.id;
  siteName = site.name;


updateURLParams({ state: site.state, group: site.group, site: site.id });


  // Update the filter button UI to highlight the current site's group
  selectFilterButtonForGroup(site.group);

  // Load the fishing report for the site's group
  await loadReportOnly(site.group);

  // Retrieve and update current flow data/statistics
  const readings = await getCurrentFlow(site.id);
  updateCurrentStats(readings, site.name);

  // Check data availability and update the charts accordingly
  if (await checkDataAvailability(site.id)) {
    flowChart = await fetch7DayData(site.id, site.name, flowChart);
    yearChart = await fetchYearData(site.id, site.name, yearChart);
  } else {
    // If no 7-day data, hide the flow chart and update the year chart only
    hide7DayChart();
    yearChart = await fetchYearData(site.id, site.name, yearChart);
  }
}



const markers = [];
const map = L.map('map', {
  center: mapCenter,
  zoom: mapZoom,
  scrollWheelZoom: false
});

// Add scroll hint
const zoomHint = L.control({ position: 'bottomleft' });
zoomHint.onAdd = function () {
  const div = L.DomUtil.create('div', 'zoom-hint');
  div.innerHTML = '🔍 Hold <strong>Ctrl</strong> (or <strong>⌘</strong>) and scroll to zoom the map';
  div.style.padding = '4px 8px';
  div.style.background = 'rgba(255,255,255,0.9)';
  div.style.border = '1px solid #ccc';
  div.style.borderRadius = '6px';
  div.style.fontSize = '0.85rem';
  div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
  return div;
};
zoomHint.addTo(map);

map.getContainer().addEventListener('wheel', function (e) {
  if (e.ctrlKey || e.metaKey) {
    map.scrollWheelZoom.enable();
  } else {
    map.scrollWheelZoom.disable();
  }
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

async function addValidMarkers() {
  for (const site of siteData) {
    const hasData = await checkDataAvailability(site.id);
    if (!hasData) continue; // Skip sites with no 7-day data

    const icon = new L.Icon({
      iconUrl: `images/${site.state.toLowerCase()}.svg`,
      iconSize: [30, 48],
      iconAnchor: [15, 48],
      popupAnchor: [0, -48],
      shadowUrl: null,
      shadowSize: null
    });

    const marker = L.marker([site.lat, site.lng], { icon }).addTo(map);
    marker.bindPopup(`${site.name}`);

    const flowData = await getCurrentFlow(site.id);
    const tooltipText = flowData.flow
      ? `${site.name}<br>💧 Flow: ${Math.round(flowData.flow).toLocaleString()} CFS`
      : `${site.name}<br>💧 Flow: Unavailable`;

    marker.bindTooltip(tooltipText, {
      direction: 'top', offset: [0, -10], opacity: 0.95
    });

    marker.on('click', async () => {
      await updateChartsForSite(site);
    });
    

    markers.push({ marker, data: site });
  }
}


// Initialize buttons
(async () => {
  await addValidMarkers();
  createStateButtons('state-buttons');
  createFilterButtons('filter-buttons', handleFilterSelection);
  handleFilterSelection('All');
})();

// Load initial site data
checkDataAvailability(siteId).then(async hasData => {
  const readings = await getCurrentFlow(siteId);
  updateCurrentStats(readings, siteName);
  if (hasData) {
    flowChart = await fetch7DayData(siteId, siteName, flowChart);
    yearChart = await fetchYearData(siteId, siteName, yearChart);
  } else {
    hide7DayChart();
    yearChart = await fetchYearData(siteId, siteName, yearChart);
  }
});

const params = new URLSearchParams(window.location.search);
if (!params.has('state') && !params.has('group') && !params.has('site')) {
  handleFilterSelection('All');
}


function applyFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  const state = params.get('state');
  const group = params.get('group');
  const site = params.get('site');

  // If a state parameter exists, simulate clicking its button.
  if (state) {
    const stateBtn = Array.from(document.querySelectorAll('.state-button'))
      .find(btn => btn.textContent === stateNames[state]);
    if (stateBtn) stateBtn.click();
  }

  // If a specific site has been provided, update the charts directly.
  if (site) {
    const selectedSite = siteData.find(s => s.id === site);
    if (selectedSite) {
      updateChartsForSite(selectedSite);
      return; // Exit so we do not override with group default.
    }
  }

  // Otherwise, if a group parameter exists, simulate clicking the corresponding group button.
  if (group) {
    setTimeout(() => {
      const groupBtn = Array.from(document.querySelectorAll('.filter-button'))
        .find(btn => btn.dataset.group === group);
      if (groupBtn) groupBtn.click();
    }, 100); // short delay ensures buttons are rendered.
  }
}


applyFiltersFromURL();
