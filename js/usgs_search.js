// Find nearby sites reporting any parameter (basic version)
export async function findNearbySitesWithParameter(lat, lon, parameterCode = '00010', bufferMiles = 30) {
    const bufferDegrees = bufferMiles / 69;
  
    const bbox = [
      (lon - bufferDegrees).toFixed(4),
      (lat - bufferDegrees).toFixed(4),
      (lon + bufferDegrees).toFixed(4),
      (lat + bufferDegrees).toFixed(4)
    ];
  
    const url = `https://waterservices.usgs.gov/nwis/site/?format=rdb&bBox=${bbox.join(',')}&parameterCd=${parameterCode}&siteStatus=all`;
  
    try {
      const response = await fetch(url);
      const text = await response.text();
  
      const lines = text.split('\n').filter(line => line && !line.startsWith('#'));
      if (lines.length < 2) {
        console.warn('No site metadata found');
        return [];
      }
  
      const sites = lines.slice(2).map(line => {
        const parts = line.split('\t');
        return {
          siteId: parts[1],
          siteName: parts[2],
          lat: parseFloat(parts[4]),
          lon: parseFloat(parts[5])
        };
      }).filter(site => !isNaN(site.lat) && !isNaN(site.lon));
  
      return sites;
    } catch (err) {
      console.error('Error searching nearby sites:', err);
      return [];
    }
  }
  
  // Smarter: Find nearby sites with live water temp (00010), limited to top 25 closest
  export async function findNearbySitesWithWaterTemp(lat, lon, bufferMiles = 50, maxSites = 25) {
    const bufferDegrees = bufferMiles / 69;
  
    const bbox = [
      (lon - bufferDegrees).toFixed(4),
      (lat - bufferDegrees).toFixed(4),
      (lon + bufferDegrees).toFixed(4),
      (lat + bufferDegrees).toFixed(4)
    ];
  
    const siteUrl = `https://waterservices.usgs.gov/nwis/site/?format=rdb&bBox=${bbox.join(',')}&parameterCd=00010&siteStatus=all`;
  
    try {
      const siteResponse = await fetch(siteUrl);
      const siteText = await siteResponse.text();
  
      const siteLines = siteText.split('\n').filter(line => line && !line.startsWith('#'));
      if (siteLines.length < 2) {
        console.warn('No sites metadata found');
        return [];
      }
  
      const siteEntries = siteLines.slice(2).map(line => {
        const parts = line.split('\t');
        return {
          siteId: parts[1],
          siteName: parts[2],
          lat: parseFloat(parts[4]),
          lon: parseFloat(parts[5])
        };
      }).filter(site => !isNaN(site.lat) && !isNaN(site.lon));
  
      if (siteEntries.length === 0) {
        console.warn('No parsed nearby sites found');
        return [];
      }
  
      // Sort by distance and limit to maxSites
      const sortedSites = siteEntries.sort((a, b) => {
        const distA = haversineDistance(lat, lon, a.lat, a.lon);
        const distB = haversineDistance(lat, lon, b.lat, b.lon);
        return distA - distB;
      }).slice(0, maxSites);
  
      const siteIds = sortedSites.map(site => site.siteId);
      const batchSize = 50;
      const batches = [];
  
      for (let i = 0; i < siteIds.length; i += batchSize) {
        batches.push(siteIds.slice(i, i + batchSize).join(','));
      }
  
      let liveSiteIds = [];
      const now = new Date();
      const seventyTwoHoursAgo = new Date(now.getTime() - (72 * 60 * 60 * 1000)); // 72 hours ago
  
      for (const batch of batches) {
        const ivUrl = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${batch}&parameterCd=00010&siteStatus=all`;
  
        try {
          const ivResponse = await fetch(ivUrl);
          const ivData = await ivResponse.json();
  
          if (ivData.value && ivData.value.timeSeries) {
            const validIds = ivData.value.timeSeries
              .filter(ts => {
                const values = ts.values[0]?.value;
                if (!values || values.length === 0) return false;
                const latest = values[values.length - 1];
                if (!latest.value) return false;
                const readingTime = new Date(latest.dateTime);
                return readingTime > seventyTwoHoursAgo;
              })
              .map(ts => ts.sourceInfo.siteCode[0].value);
  
            liveSiteIds.push(...validIds);
          }
        } catch (err) {
          console.error('Batch error:', err);
        }
      }
  
      const liveSites = sortedSites.filter(site => liveSiteIds.includes(site.siteId));
      return liveSites;
    } catch (err) {
      console.error('Error finding nearby sites with live water temp:', err);
      return [];
    }
  }
  
  // Calculate distance between two points (Haversine formula)
  export function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const toRadians = angle => angle * (Math.PI / 180);
  
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
  
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
    return R * c; // Distance in km
  }
  