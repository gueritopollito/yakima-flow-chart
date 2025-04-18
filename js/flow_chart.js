// flow_chart.js

import { getCurrentFlow, getHistoricalFlow } from './usgs.js';
import { findNearbySitesWithWaterTemp, haversineDistance } from './usgs_search.js';

// Your WeatherAPI key
const WEATHER_API_KEY = 'fc06248d0bfe4dbeb4f31014251804';

// South Platte at Trumbull
const siteId  = '06701900';
const siteLat = 39.3897;
const siteLon = -105.2272;

let chart; // holds the Chart.js instance

/**
 * Helper to fetch instantaneous (IV) flow for the past `daysBack` days.
 */
async function fetchIVData(siteId, daysBack) {
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}` +
              `&parameterCd=00060&siteStatus=all&period=P${daysBack}D`;
  try {
    const res  = await fetch(url);
    const json = await res.json();
    const series = json.value.timeSeries?.[0]?.values?.[0]?.value || [];
    return series.map(dp => ({
      dateTime: dp.dateTime,
      value:    parseFloat(dp.value)
    }));
  } catch (err) {
    console.error(`Error fetching IV data for ${daysBack} days:`, err);
    return [];
  }
}

/**
 * Fetch current weather conditions from WeatherAPI.
 */
async function fetchWeather(lat, lon) {
  try {
    const res  = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}`
    );
    const json = await res.json();
    return {
      airTemp:   json.current.temp_f,
      windSpeed: json.current.wind_mph,
      condition: json.current.condition.text
    };
  } catch (err) {
    console.error('Weather fetch failed:', err);
    return { airTemp: null, windSpeed: null, condition: null };
  }
}

/**
 * Populate the dashboard tiles with USGS + weather data.
 */
async function populateTiles() {
  const usgs    = await getCurrentFlow(siteId);
  const weather = await fetchWeather(siteLat, siteLon);

  document.querySelector('.flow-value').innerText =
    usgs.flow != null ? usgs.flow.toFixed(0) : 'N/A';
  document.querySelector('.gauge-value').innerText =
    usgs.gaugeHeight != null ? usgs.gaugeHeight.toFixed(2) : 'N/A';

  if (usgs.waterTemp != null) {
    document.querySelector('.temp-value').innerText = usgs.waterTemp.toFixed(1);
  } else {
    const nearby = await findNearbySitesWithWaterTemp(siteLat, siteLon, 50);
    if (nearby.length) {
      const closest = nearby.reduce((a, b) => {
        const da = haversineDistance(siteLat, siteLon, a.lat, a.lon);
        const db = haversineDistance(siteLat, siteLon, b.lat, b.lon);
        return da < db ? a : b;
      });
      const wf = await getCurrentFlow(closest.siteId, true);
      document.querySelector('.temp-value').innerText =
        wf.waterTemp != null ? wf.waterTemp.toFixed(1) : 'N/A';
    } else {
      document.querySelector('.temp-value').innerText = 'N/A';
    }
  }

  document.querySelector('.wind-value').innerText =
    weather.windSpeed != null ? weather.windSpeed.toFixed(1) : 'N/A';
  document.querySelector('.airtemp-value').innerText =
    weather.airTemp != null ? weather.airTemp.toFixed(1) : 'N/A';
  document.querySelector('.condition-value').innerText =
    weather.condition || 'N/A';
}

/**
 * Render the flow chart for the given number of days back.
 * Uses IV data for anything ≤ 30 days, and daily averages for longer.
 */
async function renderFlowChart(daysBack = 7) {
  let raw;

  if (daysBack <= 30) {
    raw = await fetchIVData(siteId, daysBack);
    // no extra filtering needed: the API gives exactly period=P{x}D
  } else {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - daysBack);
    raw = await getHistoricalFlow(siteId, start, end);
  }

  if (!raw?.length) {
    console.error('No flow data available for chart');
    return;
  }

  // Convert into { x: Date, y: Number } points
  const points = raw.map(d => ({
    x: new Date(d.dateTime),
    y: d.value
  }));

  const ctx = document.getElementById('flowChart').getContext('2d');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Flow (cfs)',
        data: points,
        borderColor: '#000',
        backgroundColor: 'rgba(34,197,94,0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 8,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: daysBack > 1 ? 'day' : 'hour',
            tooltipFormat: 'MMM d h:mma',
            displayFormats: {
              day:   'MMM d',
              hour:  'h a',
              month: 'MMM yyyy'
            }
          },
          ticks: {
            autoSkip: true,
            maxTicksLimit: daysBack > 1 ? Math.min(daysBack, 10) : 10
          },
          grid: { display: false }
        },
        y: {
          title: {
            display: true,
            text: 'Cubic Feet per Second (CFS)',
            font: { size: 14 }
          },
          grid: { color: 'rgba(200,200,200,0.2)' }
        }
      },
      plugins: {
        tooltip: {
          mode: 'nearest',
          intersect: false,
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed.y} cfs`
          }
        },
        legend: { display: false }
      }
    }
  });
}

/**
 * Initialize dashboard: populate tiles,
 * wire up dropdown, and draw initial chart.
 */
async function initializeDashboard() {
  await populateTiles();

  const select = document.getElementById('rangeSelect');
  select.addEventListener('change', () => {
    renderFlowChart(parseInt(select.value, 10));
  });

  // Draw initial chart
  renderFlowChart(parseInt(select.value, 10));
}

document.addEventListener('DOMContentLoaded', initializeDashboard);
