import { siteData, groupColors } from './siteData.js';
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
const filterGroups = ['All', 'Yakima', 'Skagit', 'Skykomish', 'Snoqualmie', 'Cedar', 'Stillaguamish', 'Sauk', 'Klickitat', 'Methow', 'Olympic'];

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

function createFilterButtons(containerId, onFilterSelect) {
  const container = document.getElementById(containerId);
  let activeButton = null;

  filterGroups.forEach(group => {
    const btn = document.createElement('button');
    btn.textContent = group;
    btn.classList.add('filter-button');
    btn.dataset.group = group;

    btn.style.backgroundColor = '#fff';
    btn.style.color = group === 'Klickitat' ? '#000' : (groupColors[group] || '#333');
    btn.style.border = `2px solid ${groupColors[group] || '#555'}`;
    btn.style.borderRadius = '999px';
    btn.style.margin = '0.25rem';
    btn.style.padding = '0.5rem 1rem';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '500';
    btn.style.transition = 'all 0.2s ease-in-out';
    btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
    btn.style.fontSize = '0.95rem';

    btn.onmouseenter = () => {
      btn.style.backgroundColor = `${groupColors[group] || '#ccc'}22`;
    };
    btn.onmouseleave = () => {
      if (btn !== activeButton) {
        btn.style.backgroundColor = '#fff';
      }
    };

    btn.onclick = () => {
      if (activeButton) {
        activeButton.style.backgroundColor = '#fff';
        activeButton.style.outline = 'none';
        activeButton.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
      }
      btn.style.backgroundColor = `${groupColors[group] || '#ccc'}11`;
      btn.style.outline = `2px solid #444`;
      btn.style.boxShadow = `0 0 8px ${groupColors[group]}`;
      activeButton = btn;
      onFilterSelect(group);
    };

    if (group === 'All') {
      btn.style.backgroundColor = `${groupColors[group] || '#ccc'}11`;
      btn.style.outline = '2px solid #444';
      btn.style.boxShadow = `0 0 8px ${groupColors[group]}`;
      activeButton = btn;
    }

    container.appendChild(btn);
  });
}

function selectFilterButtonForGroup(group) {
  const buttons = document.querySelectorAll('#filter-buttons .filter-button');
  buttons.forEach(btn => {
    const isMatch = btn.dataset.group === group;
    btn.style.backgroundColor = isMatch ? `${groupColors[group] || '#ccc'}11` : '#fff';
    btn.style.outline = isMatch ? '2px solid #444' : 'none';
    btn.style.boxShadow = isMatch ? `0 0 8px ${groupColors[group]}` : '0 1px 2px rgba(0,0,0,0.1)';
  });
}

async function loadReportOnly(group) {
  const summaryContainer = document.getElementById('river-summary');
  try {
    const reports = await loadFishingReports();
    const report = reports[group];
    if (report) {
      summaryContainer.innerHTML = `
        <h3>Fishing Report: ${report.river} River</h3>
        <p style="white-space: pre-line; text-align: left;">${report.summary}</p>
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
  markers.forEach(({ marker, data }) => {
    if (group === 'All' || data.group === group) {
      marker.addTo(map);
    } else {
      map.removeLayer(marker);
    }
  });

  const visible = siteData.filter(site => group === 'All' || site.group === group);
  if (visible.length > 0) {
    if (visible.length === 1) {
      map.setView([visible[0].lat, visible[0].lng], 11);
    } else {
      const bounds = L.latLngBounds(visible.map(s => [s.lat, s.lng]));
      map.fitBounds(bounds);
    }
  }

  const summaryContainer = document.getElementById('river-summary');
  if (group === 'All') {
    summaryContainer.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100%; text-align: center;">
        <p style="font-size: 1.2rem; font-weight: 300; padding: 2rem;">
          Select a River at the top of the page to view a fishing report summary from local fly shops and guide services.
        </p>
      </div>
    `;
    return;
  }

  await loadReportOnly(group);

  if (group !== 'All' && visible.length > 0) {
    const defaultSite = visible[0];
    siteId = defaultSite.id;
    siteName = defaultSite.name;
    const readings = await getCurrentFlow(siteId);
    updateCurrentStats(readings, siteName);
    const hasData = await checkDataAvailability(siteId);
    if (hasData) {
      flowChart = await fetch7DayData(siteId, siteName, flowChart);
      yearChart = await fetchYearData(siteId, siteName, yearChart);
    } else {
      hide7DayChart();
      yearChart = await fetchYearData(siteId, siteName, yearChart);
    }
  }
}

function hide7DayChart() {
  document.getElementById('yakimaFlowChart').style.display = 'none';
  document.getElementById('sevenDayTitle').textContent = `Past 7 Days – No recent data for ${siteName}`;
}

const markers = [];
// Initialize map with scroll zoom disabled
const map = L.map('map', {
  center: mapCenter,
  zoom: mapZoom,
  scrollWheelZoom: false
});

// Display a tooltip for scroll zoom hint
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

// Enable zoom on Ctrl/Cmd scroll only
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

document.querySelectorAll('.leaflet-control-attribution img').forEach(img => img.remove());

siteData.forEach(async site => {
  const icon = new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${groupColors[site.group] || 'grey'}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
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
    siteId = site.id;
    siteName = site.name;
    selectFilterButtonForGroup(site.group);
    await loadReportOnly(site.group);
    const readings = await getCurrentFlow(siteId);
    updateCurrentStats(readings, siteName);
    const hasData = await checkDataAvailability(siteId);
    if (hasData) {
      flowChart = await fetch7DayData(siteId, siteName, flowChart);
      yearChart = await fetchYearData(siteId, siteName, yearChart);
    } else {
      hide7DayChart();
      yearChart = await fetchYearData(siteId, siteName, yearChart);
    }
  });

  markers.push({ marker, data: site });
});

createFilterButtons('filter-buttons', handleFilterSelection);

checkDataAvailability(siteId).then(async hasData => {
  const readings = await getCurrentFlow(siteId);
  updateCurrentStats(readings, siteName);

  if (hasData) {
    fetch7DayData(siteId, siteName, flowChart).then(fc => {
      if (!flowChart) flowChart = fc;
      return fetchYearData(siteId, siteName, yearChart);
    }).then(yc => {
      if (!yearChart) yearChart = yc;
    });
  } else {
    hide7DayChart();
    fetchYearData(siteId, siteName, yearChart).then(yc => {
      if (!yearChart) yearChart = yc;
    });
  }
});

handleFilterSelection('Yakima');
