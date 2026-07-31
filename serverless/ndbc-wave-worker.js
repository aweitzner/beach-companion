const CACHE_SECONDS = 600;
const SUPPORTED_STATIONS = Object.freeze({
  '44091': Object.freeze({
    stationId: '44091',
    label: 'NDBC 44091',
    sourceUrl: 'https://www.ndbc.noaa.gov/station_page.php?station=44091'
  })
});

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const stationId = url.searchParams.get('station') || '';
    const station = SUPPORTED_STATIONS[stationId];
    if (!station) {
      return jsonResponse({ error: 'Unsupported NDBC station' }, 400);
    }

    try {
      const text = await fetchNdbcText(stationId);
      const observation = parseNdbcWaveObservation(text);
      if (!observation) {
        return jsonResponse({ error: 'No wave observation available' }, 502);
      }

      return jsonResponse({
        stationId,
        sourceLabel: station.label,
        sourceUrl: station.sourceUrl,
        observation,
        fetchedAt: new Date().toISOString()
      }, 200, {
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`
      });
    } catch (error) {
      return jsonResponse({
        error: 'NDBC waves unavailable',
        detail: error?.message || String(error)
      }, 502);
    }
  }
};

async function fetchNdbcText(stationId) {
  const res = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${stationId}.txt`, {
    headers: {
      accept: 'text/plain'
    }
  });
  if (!res.ok) {
    throw new Error(`NDBC ${stationId} failed (${res.status || 'no status'})`);
  }
  return res.text();
}

function parseNdbcWaveObservation(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const headerLine = lines.find(line => line.startsWith('#YY') || line.startsWith('#yr'));
  if (!headerLine) return null;

  const columns = headerLine.replace(/^#/, '').trim().split(/\s+/);
  const waveHeightIndex = columns.indexOf('WVHT');
  const dominantPeriodIndex = columns.indexOf('DPD');
  const averagePeriodIndex = columns.indexOf('APD');
  const meanDirectionIndex = columns.indexOf('MWD');
  if (waveHeightIndex < 0 || dominantPeriodIndex < 0) return null;

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const values = line.split(/\s+/);
    const significantHeightM = parseNdbcNumber(values[waveHeightIndex]);
    const periodS = parseNdbcNumber(values[dominantPeriodIndex]);
    if (!Number.isFinite(significantHeightM) || !Number.isFinite(periodS)) continue;

    const year = Number.parseInt(values[0], 10);
    const month = Number.parseInt(values[1], 10);
    const day = Number.parseInt(values[2], 10);
    const hour = Number.parseInt(values[3], 10);
    const minute = Number.parseInt(values[4], 10);

    return {
      significantHeightM,
      periodS,
      averagePeriodS: parseNdbcNumber(values[averagePeriodIndex]),
      meanDirectionDegrees: parseNdbcNumber(values[meanDirectionIndex]),
      observationTime: new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString(),
      time: new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString()
    };
  }

  return null;
}

function parseNdbcNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
