const BMA_URL = 'https://apps.web.maine.gov/online/healthy_beaches/mapdata_bma.geojson';
const SITE_URL = 'https://apps.web.maine.gov/online/healthy_beaches/mapdata_site.geojson';
const CACHE_SECONDS = 900;
const BEACH_GROUPS = Object.freeze({
  bar_harbor: Object.freeze([
    Object.freeze({
      id: 'bar_harbor_town',
      label: 'Bar Harbor Beaches',
      beachNames: Object.freeze(['Bar Beach', 'Hadley Point', 'Hulls Cove', 'Town Beach'])
    }),
    Object.freeze({
      id: 'acadia_mdi',
      label: 'Acadia / Mount Desert Beaches',
      beachNames: Object.freeze(['Sand Beach', 'Seal Harbor'])
    })
  ]),
  kennebunkport: Object.freeze([
    Object.freeze({
      id: 'kennebunk_ocean',
      label: 'Kennebunk Ocean Beaches',
      beachNames: Object.freeze(['Goochs Beach', 'Mothers Beach'])
    }),
    Object.freeze({
      id: 'kennebunkport_ocean',
      label: 'Kennebunkport Ocean Beaches',
      beachNames: Object.freeze(['Colony Beach', 'Goose Rocks Beach - Main Beach'])
    })
  ])
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
    const beachId = url.searchParams.get('beach') || '';
    const groups = BEACH_GROUPS[beachId];
    if (!groups) {
      return jsonResponse({ error: 'Unsupported Maine beach' }, 400);
    }

    try {
      const [bmaData, siteData] = await Promise.all([
        fetchJson(BMA_URL),
        fetchJson(SITE_URL)
      ]);
      const waterQuality = buildMaineWaterQuality(beachId, groups, bmaData, siteData);
      return jsonResponse(waterQuality, 200, {
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`
      });
    } catch (error) {
      return jsonResponse({
        error: 'Maine Healthy Beaches unavailable',
        detail: error?.message || String(error)
      }, 502);
    }
  }
};

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`${url} failed (${res.status || 'no status'})`);
  }
  return res.json();
}

function buildMaineWaterQuality(beachId, groups, bmaData, siteData) {
  const bmaFeatures = (bmaData.features || []).map(normalizeBmaFeature).filter(Boolean);
  const siteFeatures = (siteData.features || []).map(normalizeSiteFeature).filter(Boolean);

  return {
    beachId,
    locations: groups.map(group => buildMaineLocation(group, bmaFeatures, siteFeatures)),
    sourceLabel: 'Maine Healthy Beaches',
    sourceUrl: 'https://apps.web.maine.gov/online/healthy_beaches/public/status-table.html',
    fetchedAt: new Date().toISOString()
  };
}

function buildMaineLocation(group, bmaFeatures, siteFeatures) {
  const expectedNames = new Set(group.beachNames.map(normalizeName));
  const beaches = bmaFeatures.filter(beach => expectedNames.has(normalizeName(beach.beachName)));
  const sites = siteFeatures.filter(site => expectedNames.has(normalizeName(site.beachName)));
  const samples = sites
    .map(site => site.latestSample)
    .filter(Boolean)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const activeIncident = getMaineActiveIncident(beaches);

  return {
    id: group.id,
    label: group.label,
    activeIncident,
    latestSample: samples[0] || null,
    latestSamples: samples,
    latestElevatedSample: samples.find(sample => sample.elevated) || null,
    sampleCount: samples.length,
    incidentCount: activeIncident ? 1 : 0,
    stationNames: uniqueSorted(sites.map(site => site.siteId).filter(Boolean)),
    beachNames: uniqueSorted(beaches.map(beach => beach.beachName).filter(Boolean)),
    sourceUrls: uniqueSorted(beaches.map(beach => beach.sourceUrl).filter(Boolean)),
    advisoryComments: beaches
      .filter(beach => beach.comment)
      .map(beach => `${beach.beachName}: ${beach.comment}`)
  };
}

function normalizeBmaFeature(feature) {
  const properties = feature?.properties || {};
  const beachName = properties['Beach Management Area'];
  if (!beachName) return null;

  return {
    beachName,
    managementEntity: properties['Management Entity'],
    advisoryType: properties['Advisory Type'] || 'No Active Advisory',
    advisoryStatus: properties['Advisory Status'] || '',
    advisoryStartDate: properties['Advisory Start Date'] || '',
    comment: properties['Public Comment'] || '',
    sourceUrl: properties['Beach Info Page'] || '',
    lat: feature?.geometry?.coordinates?.[1],
    lon: feature?.geometry?.coordinates?.[0]
  };
}

function normalizeSiteFeature(feature) {
  const properties = feature?.properties || {};
  const siteId = properties['Site ID'];
  const beachName = properties['Beach Management Area'];
  if (!siteId || !beachName) return null;

  const sampleDate = parseMaineDate(properties['Most Recent Date Collected']);
  const value = parseMaineSampleValue(properties['Most Recent Enterococcus Bacteria Result (MPN/100mL)']);

  return {
    siteId,
    beachName,
    managementEntity: properties['Management Entity'],
    description: properties['Site Description'],
    sourceUrl: properties['Beach Info Page'] || '',
    latestSample: sampleDate && Number.isFinite(value) ? {
      date: sampleDate,
      dateLabel: properties['Most Recent Date Collected'] || '',
      timeLabel: '',
      stationName: siteId,
      beachName,
      locationType: properties['Monitoring Frequency'] || 'Maine Healthy Beaches',
      value,
      rawValue: properties['Most Recent Enterococcus Bacteria Result (MPN/100mL)'],
      units: 'MPN/100mL',
      resultType: 'Enterococcus',
      elevated: properties['Elevated Bacteria'] === 'Yes' || value >= 104
    } : null
  };
}

function getMaineActiveIncident(beaches) {
  return beaches
    .map(beach => {
      const type = getMaineIncidentType(beach.advisoryType);
      if (!type) return null;
      return {
        type,
        locationLabel: beach.beachName,
        rawType: beach.advisoryType,
        reason: beach.comment || beach.beachName,
        startLabel: beach.advisoryStartDate,
        sourceUrl: beach.sourceUrl
      };
    })
    .filter(Boolean)
    .sort((a, b) => getMaineIncidentRank(b.type) - getMaineIncidentRank(a.type))[0] || null;
}

function getMaineIncidentType(advisoryType) {
  const normalized = String(advisoryType || '').toLowerCase();
  if (!normalized || normalized.includes('no active')) return null;
  if (normalized.includes('closure') || normalized.includes('closed')) return 'CLOSURE';
  if (normalized.includes('rainfall')) return 'RAINFALL';
  if (normalized.includes('bacteria') || normalized.includes('contamination') || normalized.includes('advisory')) return 'ADVISORY';
  return 'ADVISORY';
}

function getMaineIncidentRank(type) {
  if (type === 'CLOSURE') return 3;
  if (type === 'ADVISORY') return 2;
  if (type === 'RAINFALL') return 1;
  return 0;
}

function parseMaineDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseMaineSampleValue(value) {
  const normalized = String(value || '').replace('<', '').replace(/,/g, '').trim();
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
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
