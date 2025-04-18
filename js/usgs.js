// usgs.js — Clean fetch-only USGS functions

// Fetch current flow, water temp, air temp, and gauge height
export async function getCurrentFlow(siteId, onlyTemp = false) {
  const params = onlyTemp ? '00010' : '00060,00010,00020,00065';
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=${params}&siteStatus=all&period=PT2H`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const series = data.value.timeSeries;

    let flow = null;
    let waterTemp = null;
    let airTemp = null;
    let gaugeHeight = null;

    series.forEach(s => {
      const param = s.variable.variableCode[0].value;
      const val = parseFloat(s.values[0]?.value?.[0]?.value);
      if (param === '00060') flow = val;
      if (param === '00010') waterTemp = val;
      if (param === '00020') airTemp = val;
      if (param === '00065') gaugeHeight = val;
    });

    return { flow, waterTemp, airTemp, gaugeHeight };
  } catch (err) {
    console.error(`Error fetching data for site ${siteId}:`, err);
    return { flow: null, waterTemp: null, airTemp: null, gaugeHeight: null };
  }
}

// Check if flow data is available
export async function checkDataAvailability(siteId) {
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P7D`;
  const response = await fetch(url);
  const data = await response.json();
  return data.value.timeSeries.length > 0;
}

// Fetch 7 days of instantaneous flow data
export async function fetch7DayData(siteId) {
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P7D`;
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.value.timeSeries || data.value.timeSeries.length === 0) {
      return [];
    }

    const timeSeries = data.value.timeSeries[0].values[0].value;

    return timeSeries.map(dp => ({
      dateTime: dp.dateTime,
      value: parseFloat(dp.value)
    }));
  } catch (err) {
    console.error(`Error fetching 7-day data for site ${siteId}:`, err);
    return [];
  }
}

// Fetch past year of daily average flow data
export async function fetchYearData(siteId) {
  const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P365D`;
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.value.timeSeries || data.value.timeSeries.length === 0) {
      return [];
    }

    const rawValues = data.value.timeSeries[0].values[0].value;

    return rawValues.map(dp => ({
      dateTime: dp.dateTime,
      value: parseFloat(dp.value)
    }));
  } catch (err) {
    console.error(`Error fetching 1-year data for site ${siteId}:`, err);
    return [];
  }
}

export async function getHistoricalFlow(siteId, startDate, endDate) {
  const formatDate = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
      console.error('Invalid date passed to formatDate:', date);
      return '';
    }
    return date.toISOString().split('T')[0];
  };

  const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${siteId}&parameterCd=00060&startDT=${formatDate(startDate)}&endDT=${formatDate(endDate)}&siteStatus=all`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    const series = json.value.timeSeries[0];
    const values = series.values[0].value;

    return values.map(dp => ({
      dateTime: dp.dateTime,
      value: parseFloat(dp.value)
    })).filter(d => !isNaN(d.value));
  } catch (err) {
    console.error('Error fetching historical flow data:', err);
    return [];
  }
}


