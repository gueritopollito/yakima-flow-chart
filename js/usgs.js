// usgs.js – Fetch and render flow data from USGS

export async function getCurrentFlow(siteId) {
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060,00010,00020&siteStatus=all&period=PT2H`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      const series = data.value.timeSeries;
  
      let flow = null;
      let waterTemp = null;
      let airTemp = null;
  
      series.forEach(s => {
        const param = s.variable.variableCode[0].value;
        const val = parseFloat(s.values[0]?.value?.[0]?.value);
        if (param === '00060') flow = val;
        if (param === '00010') waterTemp = val;
        if (param === '00020') airTemp = val;
      });
  
      return { flow, waterTemp, airTemp };
    } catch (err) {
      console.error(`Error fetching data for site ${siteId}:`, err);
      return { flow: null, waterTemp: null, airTemp: null };
    }
  }
  
  export async function checkDataAvailability(siteId) {
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P7D`;
    const response = await fetch(url);
    const data = await response.json();
    return data.value.timeSeries.length > 0;
  }
  
  function getWadingSafety(flow) {
    if (flow == null || isNaN(flow)) return 'Unknown';
    if (flow < 100) return 'Very Low';
    if (flow >= 100 && flow < 300) return 'Good for Wading';
    if (flow >= 300 && flow < 700) return 'Ideal for Wading or Floating';
    if (flow >= 700 && flow < 1200) return 'Caution for Wading';
    if (flow >= 1200 && flow < 2500) return 'Float – Wading Unsafe';
    return 'Experienced Float Only';
  }
  
  export async function fetch7DayData(siteId, siteName, flowChart) {
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060&siteStatus=all&period=P7D`;
    const response = await fetch(url);
    const data = await response.json();
    const timeSeries = data.value.timeSeries[0].values[0].value;
  
    const labels = timeSeries.map(dp => new Date(dp.dateTime).toISOString());
    const values = timeSeries.map(dp => parseFloat(dp.value));
    const latestFlow = values[values.length - 1];
    const safety = getWadingSafety(latestFlow);
  
    if (siteName && siteName.trim()) {
        document.getElementById('sevenDayTitle').innerHTML = `
          <div style="text-align: center;">
            <h2 style="margin: 0;">River Flow – Past 7 Days</h2>
            <div style="font-weight: 300;">${siteName} – <span style="color: ${safety.includes('Wading') ? 'green' : safety.includes('Ideal') ? 'blue' : safety.includes('High') ? 'orange' : 'red'}">${safety}</span></div>
          </div>
        `;
      }
      
    document.getElementById('yakimaFlowChart').style.display = 'block';
  
    const chartContainer = document.getElementById('yakimaFlowChartContainer');
    if (chartContainer && !document.getElementById('flowLegend')) {
      const legend = document.createElement('div');
      legend.id = 'flowLegend';
      legend.style.marginTop = '1rem';
      legend.style.fontSize = '0.9rem';
      legend.innerHTML = `
        <h4>Flow Guidance (CFS)</h4>
        <ul style="text-align: left; max-width: 600px; margin: auto; padding-left: 1.5rem;">
          <li><strong>&lt; 100:</strong> Very low. Likely too shallow for floating. Wading easy, but spooks fish.</li>
          <li><strong>100–300:</strong> Good wading. Cautious float possible depending on depth.</li>
          <li><strong>300–700:</strong> Ideal for both wading and floating in many rivers.</li>
          <li><strong>700–1,200:</strong> Wading gets tougher. Floating ideal for drift boats.</li>
          <li><strong>1,200–2,500:</strong> High water. Wading can be dangerous. Floating is fast and technical.</li>
          <li><strong>&gt; 2,500:</strong> Too high for safe wading. Floating for skilled rowers only.</li>
        </ul>
      `;
      chartContainer.appendChild(legend);
    }
  
    if (flowChart) {
      flowChart.data.labels = labels;
      flowChart.data.datasets[0].data = values;
      flowChart.update();
      return flowChart;
    } else {
      return new Chart(document.getElementById('yakimaFlowChart'), {
        type: 'line',
        data: {
          labels,
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
              title: { display: true, text: 'Date', font: { size: 14 } },
              ticks: {
                callback: function(val, index, ticks) {
                  const rawLabel = this.getLabelForValue(val);
                  const date = new Date(rawLabel);
                  return date.toLocaleDateString();
                },
                maxTicksLimit: 10
              }
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
  
  export async function fetchYearData(siteId, siteName, yearChart) {
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
  
    document.getElementById('yearTitle').textContent = `Past Year – ${siteName}`;if (siteName && siteName.trim()) {
        document.getElementById('yearTitle').textContent = `Past Year – ${siteName}`;
      }
      
  
    if (yearChart) {
      yearChart.data.labels = labels;
      yearChart.data.datasets[0].data = flowValues;
      yearChart.update();
      return yearChart;
    } else {
      return new Chart(document.getElementById('yakimaYearChart'), {
        type: 'line',
        data: {
          labels,
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
  