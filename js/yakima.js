const siteData = [
  // Yakima River system
  { id: '12484500', name: 'Umtanum near Ellensburg', lat: 46.884, lng: -120.488, group: 'Yakima' },
  { id: '12479000', name: 'Cle Elum River near Roslyn', lat: 47.227, lng: -121.030, group: 'Yakima' },
  { id: '12478500', name: 'Yakima River at Cle Elum', lat: 47.195, lng: -120.939, group: 'Yakima' },
  { id: '12479600', name: 'Yakima River near South Cle Elum', lat: 47.181, lng: -120.944, group: 'Yakima' },

  // Skagit River
  { id: '12181000', name: 'Skagit River at Marblemount', lat: 48.539, lng: -121.444, group: 'Skagit' },
  { id: '12194000', name: 'Skagit River near Concrete', lat: 48.528, lng: -121.746, group: 'Skagit' },
  { id: '12200500', name: 'Skagit River near Mount Vernon', lat: 48.416, lng: -122.334, group: 'Skagit' },

  // Skykomish River
  { id: '12134500', name: 'Skykomish River near Gold Bar', lat: 47.847, lng: -121.679, group: 'Skykomish' },

  // Snoqualmie River and forks
  { id: '12144000', name: 'South Fork Snoqualmie at North Bend', lat: 47.495, lng: -121.785, group: 'Snoqualmie' },
  { id: '12141300', name: 'Middle Fork Snoqualmie near Tanner', lat: 47.472, lng: -121.641, group: 'Snoqualmie' },
  { id: '12142000', name: 'North Fork Snoqualmie near Snoqualmie Falls', lat: 47.571, lng: -121.725, group: 'Snoqualmie' },
  { id: '12149000', name: 'Snoqualmie River near Carnation', lat: 47.644, lng: -121.914, group: 'Snoqualmie' },

  // Cedar River
  { id: '12117500', name: 'Cedar River near Landsburg', lat: 47.382, lng: -121.951, group: 'Cedar' },
  { id: '12119000', name: 'Cedar River at Renton', lat: 47.489, lng: -122.143, group: 'Cedar' }
];

const groupColors = {
  Yakima: 'red',
  Skagit: 'blue',
  Skykomish: 'green',
  Snoqualmie: 'orange',
  Cedar: 'violet'
};

const mapCenter = [47.4, -121.7];
const mapZoom = 8;

const filterGroups = ['All', 'Yakima', 'Skagit', 'Skykomish', 'Snoqualmie', 'Cedar'];

let siteId = siteData[0].id;
let siteName = siteData[0].name;
let flowChart = null;
let yearChart = null;

function createFilterButtons(containerId, onFilterSelect) {
  const container = document.getElementById(containerId);
  let activeButton = null;

  filterGroups.forEach(group => {
    const btn = document.createElement('button');
    btn.textContent = group;
    btn.classList.add('filter-button');
    btn.dataset.group = group;
    btn.style.backgroundColor = group === 'All' ? '#333' : `${groupColors[group] || '#555'}20`;
    btn.style.color = group === 'All' ? '#fff' : groupColors[group] || '#000';
    btn.style.border = `2px solid ${group === 'All' ? '#555' : groupColors[group]}`;
    btn.style.borderRadius = '999px';
    btn.style.margin = '0.25rem';
    btn.style.padding = '0.5rem 1rem';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '200';
    btn.style.transition = 'all 0.2s ease-in-out';
    btn.style.boxShadow = group === 'All' ? '0 0 0' : 'none';

    btn.onmouseenter = () => {
      btn.style.filter = 'brightness(1.1)';
    };
    btn.onmouseleave = () => {
      btn.style.filter = activeButton === btn ? 'none' : 'brightness(0.9)';
    };

    btn.onclick = () => {
      if (activeButton) {
        activeButton.style.filter = 'brightness(0.9)';
        activeButton.style.outline = 'none';
        activeButton.style.boxShadow = 'none';
      }
      btn.style.filter = 'none';
      btn.style.outline = '2px solid #444';
      btn.style.boxShadow = `0 0 8px ${groupColors[group]}`;
      activeButton = btn;
      onFilterSelect(group);
    };

    btn.style.filter = group === 'All' ? 'none' : 'brightness(0.9)';
    if (group === 'All') activeButton = btn;
    container.appendChild(btn);
  });
};


function handleFilterSelection(group) {
  markers.forEach(({ marker, data }) => {
    if (group === 'All' || data.group === group) {
      marker.addTo(map);
    } else {
      map.removeLayer(marker);
    }
  });

  const visible = siteData.filter(site => group === 'All' || site.group === group);
  if (visible.length > 0) {
    const bounds = L.latLngBounds(visible.map(s => [s.lat, s.lng]));
    map.fitBounds(bounds);
  }
}

const markers = [];
let map = L.map('map').setView(mapCenter, mapZoom);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

siteData.forEach(site => {
  const icon = new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${groupColors[site.group] || 'grey'}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  const marker = L.marker([site.lat, site.lng], { icon }).addTo(map);
  marker.bindPopup(`${site.name}`);
  marker.on('click', () => {
    siteId = site.id;
    siteName = site.name;
    checkDataAvailability(siteId).then(hasData => {
      if (hasData) {
        fetch7DayData().then(fetchYearData);
      } else {
        hide7DayChart();
        fetchYearData();
      }
    });
  });
  markers.push({ marker, data: site });
});

createFilterButtons('filter-buttons', handleFilterSelection);

function hide7DayChart() {
  document.getElementById('yakimaFlowChart').style.display = 'none';
  document.getElementById('sevenDayTitle').textContent = `Past 7 Days – No recent data for ${siteName}`;
}

function show7DayChart() {
  document.getElementById('yakimaFlowChart').style.display = 'block';
}

async function checkDataAvailability(siteId) {
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P7D`;
  const response = await fetch(url);
  const data = await response.json();
  return data.value.timeSeries.length > 0;
}

async function fetch7DayData() {
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P7D`;
  const response = await fetch(url);
  const data = await response.json();
  const timeSeries = data.value.timeSeries[0].values[0].value;

  const labels = timeSeries.map(dp => new Date(dp.dateTime).toLocaleString());
  const values = timeSeries.map(dp => parseFloat(dp.value));

  const latestFlow = values[values.length - 1];
  document.getElementById('currentFlow').textContent = `Current Flow: ${latestFlow.toLocaleString()} CFS`;
  document.getElementById('sevenDayTitle').textContent = `Past 7 Days – ${siteName}`;
  show7DayChart();

  if (flowChart) {
    flowChart.data.labels = labels;
    flowChart.data.datasets[0].data = values;
    flowChart.update();
  } else {
    flowChart = new Chart(document.getElementById('yakimaFlowChart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Flow (CFS)',
          data: values,
          borderColor: '#4e79a7',
          backgroundColor: 'rgba(78, 121, 167, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: context => `${context.dataset.label}: ${context.formattedValue} CFS`
            }
          },
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: 'Date / Time', font: { size: 14 } },
            ticks: { maxTicksLimit: 10 }
          },
          y: {
            title: { display: true, text: 'Cubic Feet per Second (CFS)', font: { size: 14 } },
            grid: { color: '#e0e0e0' }
          }
        }
      }
    });
  }
}

async function fetchYearData() {
  const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P365D`;
  const response = await fetch(url);
  const data = await response.json();
  const rawValues = data.value.timeSeries[0].values[0].value;

  const labels = [];
  const flowValues = [];

  rawValues.forEach(dp => {
    const val = parseFloat(dp.value);
    const dateISO = dp.dateTime.slice(0, 10);
    if (!isNaN(val) && val > 0) {
      labels.push(dateISO);
      flowValues.push(val);
    }
  });

  document.getElementById('yearTitle').textContent = `Past Year – ${siteName}`;

  if (yearChart) {
    yearChart.data.labels = labels;
    yearChart.data.datasets[0].data = flowValues;
    yearChart.update();
  } else {
    yearChart = new Chart(document.getElementById('yakimaYearChart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Daily Avg Flow (CFS)',
            data: flowValues,
            borderColor: '#f28e2c',
            backgroundColor: 'rgba(242, 142, 44, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: context => `${context.dataset.label}: ${context.formattedValue} CFS`
            }
          },
          legend: { display: true }
        },
        scales: {
          x: {
            title: { display: true, text: 'Date', font: { size: 14 } },
            ticks: { maxTicksLimit: 12 }
          },
          y: {
            title: { display: true, text: 'Cubic Feet per Second (CFS)', font: { size: 14 } },
            grid: { color: '#e0e0e0' }
          }
        }
      }
    });
  }
}

// Kick off default load
checkDataAvailability(siteId).then(hasData => {
  if (hasData) {
    fetch7DayData().then(fetchYearData);
  } else {
    hide7DayChart();
    fetchYearData();
  }
});