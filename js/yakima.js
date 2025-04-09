// Add a Leaflet map to select USGS sites along the Yakima River
const siteData = [
  { id: '12484500', name: 'Umtanum near Ellensburg', lat: 46.884, lng: -120.488 },
  { id: '12503000', name: 'Union Gap near Yakima', lat: 46.555, lng: -120.475 },
  { id: '12508625', name: 'Below Satus Creek near Satus', lat: 46.240, lng: -120.278 },
  { id: '12510500', name: 'Kiona, WA', lat: 46.297, lng: -119.480 },
  { id: '12511800', name: 'Van Giesen Bridge near Richland', lat: 46.271, lng: -119.275 }
];

const todayISO = new Date().toISOString().slice(0, 10);
let recentDatesSet = new Set();
let siteId = siteData[0].id; // default

function loadMap() {
  const map = L.map('map').setView([46.5, -120.5], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  siteData.forEach(site => {
    const marker = L.marker([site.lat, site.lng]).addTo(map);
    marker.bindPopup(site.name);
    marker.on('click', () => {
      siteId = site.id;
      fetch7DayData().then(fetchYearData);
    });
  });
}

async function fetch7DayData() {
  recentDatesSet.clear();

  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P7D`;
  const response = await fetch(url);
  const data = await response.json();
  const timeSeries = data.value.timeSeries[0].values[0].value;

  const labels = timeSeries.map(dp => new Date(dp.dateTime).toLocaleString());
  const values = timeSeries.map(dp => parseFloat(dp.value));

  timeSeries.forEach(dp => {
    const iso = dp.dateTime.slice(0, 10);
    recentDatesSet.add(iso);
  });

  const latestFlow = values[values.length - 1];
  document.getElementById('currentFlow').textContent = `Current Flow: ${latestFlow.toLocaleString()} CFS`;

  new Chart(document.getElementById('yakimaFlowChart'), {
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
            label: function(context) {
              return `${context.dataset.label}: ${context.formattedValue} CFS`;
            }
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

async function fetchYearData() {
  const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P365D`;
  const response = await fetch(url);
  const data = await response.json();
  const rawValues = data.value.timeSeries[0].values[0].value;

  const labels = [];
  const flowValues = [];
  const recentFlowValues = [];

  rawValues.forEach(dp => {
    const val = parseFloat(dp.value);
    const dateISO = dp.dateTime.slice(0, 10);
    if (!isNaN(val) && val > 0) {
      labels.push(dateISO);
      flowValues.push(val);
      recentFlowValues.push(recentDatesSet.has(dateISO) ? val : null);
    }
  });

  new Chart(document.getElementById('yakimaYearChart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Recent Trend (7D)',
          data: recentFlowValues,
          borderColor: '#4e79a7',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          spanGaps: true
        },
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
        annotation: {
          annotations: {
            todayLine: {
              type: 'line',
              xMin: todayISO,
              xMax: todayISO,
              borderColor: 'red',
              borderWidth: 2,
              label: {
                content: 'Today',
                enabled: true,
                position: 'start',
                backgroundColor: 'rgba(255,255,255,0.8)',
                color: '#d62728'
              }
            }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.formattedValue} CFS`;
            }
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

loadMap();
fetch7DayData().then(fetchYearData);
