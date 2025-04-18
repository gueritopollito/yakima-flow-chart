import { getCurrentFlow } from './usgs.js';
import { findNearbySitesWithWaterTemp, haversineDistance } from './usgs_search.js';

const siteId = '06701900'; // South Platte River at Trumbull (your primary site)
const siteLat = 39.3897;
const siteLon = -105.2272;

// ⬇️ Your WeatherAPI key
const weatherApiKey = 'fc06248d0bfe4dbeb4f31014251804'; // <-- Replace with your real WeatherAPI key

async function fetchWeatherAPI(lat, lon) {
  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${lat},${lon}`;
    const response = await fetch(url);
    const data = await response.json();

    return {
      airTemp: data.current.temp_f,
      windSpeed: data.current.wind_mph,
      condition: data.current.condition.text,
      feelsLike: data.current.feelslike_f,
      highTemp: null, // WeatherAPI free plan doesn't give 24h high/low easily
      lowTemp: null
    };
  } catch (err) {
    console.error('WeatherAPI fetch failed:', err);
    return {
      airTemp: null,
      windSpeed: null,
      condition: null,
      feelsLike: null,
      highTemp: null,
      lowTemp: null
    };
  }
}

async function populateTiles() {
  const usgs = await getCurrentFlow(siteId);
  const weather = await fetchWeatherAPI(siteLat, siteLon);

  // Populate FLOW
  document.querySelector('.tile.flow .value').innerHTML = (usgs.flow !== null)
    ? `${usgs.flow.toFixed(0)} <span style="font-size:0.8rem;">cfs</span>`
    : 'N/A';

  // Populate GAUGE HEIGHT
  document.querySelector('.tile.gauge .value').innerHTML = (usgs.gaugeHeight !== null)
    ? `${usgs.gaugeHeight.toFixed(2)} <span style="font-size:0.8rem;">ft</span>`
    : 'N/A';

  // Populate WATER TEMP
  if (usgs.waterTemp !== null) {
    document.querySelector('.tile.temp .value').innerHTML = `${usgs.waterTemp.toFixed(1)}<span style="font-size:0.8rem;">°F</span>`;
  } else {
    console.log('No water temp at primary site, searching nearby rivers...');
    const nearbySites = await findNearbySitesWithWaterTemp(siteLat, siteLon, 50);

    if (nearbySites.length > 0) {
      const nearest = nearbySites.reduce((closest, site) => {
        const distanceToSite = haversineDistance(siteLat, siteLon, site.lat, site.lon);
        const distanceToClosest = haversineDistance(siteLat, siteLon, closest.lat, closest.lon);
        return (distanceToSite < distanceToClosest) ? site : closest;
      }, nearbySites[0]);

      console.log('Using water temp from nearby site:', nearest.siteName);

      const nearbyFlow = await getCurrentFlow(nearest.siteId, true); // onlyTemp = true
      if (nearbyFlow.waterTemp !== null) {
        document.querySelector('.tile.temp .value').innerHTML = `${nearbyFlow.waterTemp.toFixed(1)}<span style="font-size:0.8rem;">°F</span>`;
      } else {
        document.querySelector('.tile.temp .value').innerHTML = 'No Recent Temp';
      }
    } else {
      document.querySelector('.tile.temp .value').innerHTML = 'No Recent Temp';
    }
  }

  // Populate WIND SPEED
  document.querySelector('.tile.wind .value').innerHTML = (weather.windSpeed !== null)
    ? `${weather.windSpeed.toFixed(1)} <span style="font-size:0.8rem;">mph</span>`
    : 'N/A';

  // Populate AIR TEMP
  const airtempElement = document.querySelector('.tile.airtemp .value');
  if (weather.airTemp !== null) {
    airtempElement.innerHTML = `${weather.airTemp.toFixed(1)}<span style="font-size:0.8rem;">°F</span>`;
  } else {
    airtempElement.textContent = 'N/A';
  }
  // Populate WEATHER CONDITION
  const conditionElement = document.querySelector('.tile.condition .value .condition-value');
if (weather.condition !== null) {
  conditionElement.textContent = weather.condition;
} else {
  conditionElement.textContent = 'N/A';
}
}

document.addEventListener('DOMContentLoaded', async () => {
  await populateTiles();
});
