// Add a Leaflet map to select USGS sites along the Yakima River
const siteData = [
  { id: '12484500', name: 'Umtanum near Ellensburg', lat: 46.884, lng: -120.488 },
  { id: '12479000', name: 'Cle Elum River near Roslyn', lat: 47.227, lng: -121.030 },
  { id: '12478500', name: 'Yakima River at Cle Elum', lat: 47.195, lng: -120.939 },
  { id: '12479600', name: 'Yakima River near South Cle Elum', lat: 47.181, lng: -120.944 }
];

const todayISO = new Date().toISOString().slice(0, 10);
let recentDatesSet = new Set();
let siteId = siteData[0].id; // default
let siteName = siteData[0].name;
let flowChart = null;
let yearChart = null;

function loadMap() {
  const map = L.map('map').setView([47.0, -120.7], 9);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  siteData.forEach(site => {
    const marker = L.marker([site.lat, site.lng]).addTo(map);
    marker.bindPopup(`${site.name}<br>Loading data...`);

    marker.on('click', async () => {
      siteId = site.id;
      siteName = site.name;
      const hasData = await checkDataAvailability(site.id);
      if (hasData) {
        fetch7DayData().then(fetchYearData);
      } else {
        alert(`No recent flow data available for ${site.name}.`);
      }
    });

    checkDataAvailability(site.id).then(hasData => {
      if (!hasData) {
        marker.setPopupContent(`${site.name}<br>No recent data available.`);
      } else {
        marker.setPopupContent(`${site.name}`);
      }
    });
  });
}

async function checkDataAvailability(siteId) {
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P7D`;
  const response = await fetch(url);
  const data = await response.json();
  return data.value.timeSeries.length > 0;
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
  document.getElementById('sevenDayTitle').textContent = `Past 7 Days – ${siteName}`;

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

  document.getElementById('yearTitle').textContent = `Past Year – ${siteName}`;

  if (yearChart) {
    yearChart.data.labels = labels;
    yearChart.data.datasets[0].data = recentFlowValues;
    yearChart.data.datasets[1].data = flowValues;
    yearChart.update();
  } else {
    yearChart = new Chart(document.getElementById('yakimaYearChart'), {
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

loadMap();
fetch7DayData().then(fetchYearData);
