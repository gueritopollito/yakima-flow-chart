import { getCurrentFlow } from './usgs.js';
import { findNearbySitesWithWaterTemp, haversineDistance } from './usgs_search.js';

const siteId = '06701900'; // South Platte River at Trumbull (your primary site)
const siteLat = 39.3897;
const siteLon = -105.2272;

async function fetchNOAAWeather(lat, lon) {
  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
    const pointData = await pointRes.json();
    const stationUrl = pointData.properties.observationStations;

    const stationRes = await fetch(stationUrl);
    const stationData = await stationRes.json();
    const stationId = stationData.features[0].properties.stationIdentifier;

    const obsRes = await fetch(`https://api.weather.gov/stations/${stationId}/observations/latest`);
    const obsData = await obsRes.json();

    const temp = obsData.properties.temperature.value;
    const wind = obsData.properties.windSpeed.value;
    const rawHigh = obsData.properties.maxTemperatureLast24Hours?.value;
    const rawLow = obsData.properties.minTemperatureLast24Hours?.value;

    return {
      airTemp: temp !== null ? (temp * 9/5 + 32).toFixed(1) : null,
      windSpeed: wind !== null ? (wind * 2.23694).toFixed(1) : null,
      highTemp: rawHigh !== null ? (rawHigh * 9/5 + 32).toFixed(0) : null,
      lowTemp: rawLow !== null ? (rawLow * 9/5 + 32).toFixed(0) : null
    };
  } catch (err) {
    console.error('NOAA fetch failed:', err);
    return {
      airTemp: null,
      windSpeed: null,
      highTemp: null,
      lowTemp: null
    };
  }
}

async function populateTiles() {
  const usgs = await getCurrentFlow(siteId);
  const noaa = await fetchNOAAWeather(siteLat, siteLon);

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
  document.querySelector('.tile.wind .value').innerHTML = (noaa.windSpeed !== null)
    ? `${noaa.windSpeed} <span style="font-size:0.8rem;">mph</span>`
    : 'N/A';

  // Populate HIGH / LOW
  const highlowElement = document.querySelector('.tile.highlow .value');
  if (noaa.highTemp !== null && noaa.lowTemp !== null) {
    highlowElement.innerHTML = `${noaa.highTemp}° / ${noaa.lowTemp}°<span style="font-size:0.8rem;">F</span>`;
  } else if (noaa.airTemp !== null) {
    highlowElement.innerHTML = `${noaa.airTemp}<span style="font-size:0.8rem;">°F</span>`;
  } else {
    highlowElement.textContent = 'N/A';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await populateTiles();
});
