const APP_VERSION = 'v1.5.45';
const queryParams = new URLSearchParams(window.location.search);
const MAINE_WATER_QUALITY_PROXY_URL = queryParams.get('mhbProxyUrl') || '/api/water-quality/maine';
const NDBC_WAVES_PROXY_URL = queryParams.get('wavesProxyUrl') || 'https://beach-companion-ndbc-waves.a-weitzner.workers.dev';
const TEST_MODE = queryParams.get('testMode') === '1';
const TEST_MODE_CONFIG = Object.freeze({
  enabled: TEST_MODE,
  simNowRaw: queryParams.get('simNow'),
  weatherFixture: queryParams.get('weatherFixture'),
  alertsFixture: queryParams.get('alertsFixture'),
  tidesFixture: queryParams.get('tidesFixture'),
  waterTempFixture: queryParams.get('waterTempFixture'),
  wavesFixture: queryParams.get('wavesFixture'),
  astronomyFixture: queryParams.get('astronomyFixture')
});
const SIMULATED_NOW = parseSimulatedNow(TEST_MODE_CONFIG.simNowRaw);
const testModeErrors = [];
// Regional wind panels use beach-specific coastal image crops as an interim
// visual layer until the final clean SVG shoreline assets are ready.
const WIND_REGION_PANELS = Object.freeze({
  sandy_hook: Object.freeze({
    imagePath: 'assets/wind-panels/sandy-hook.png',
    imageWidth: 297,
    imageHeight: 407,
    marker: Object.freeze({ x: 79, y: 63 }),
    arrowOffset: Object.freeze({ x: 18, y: -2 })
  }),
  monmouth: Object.freeze({
    imagePath: 'assets/wind-panels/asbury-belmar.png',
    imageWidth: 343,
    imageHeight: 598,
    beaches: Object.freeze({
      asbury_park: Object.freeze({ x: 76, y: 35 }),
      belmar: Object.freeze({ x: 79, y: 74 })
    }),
    arrowOffset: Object.freeze({ x: 16, y: -4 })
  }),
  cape_may: Object.freeze({
    imagePath: 'assets/wind-panels/cape-may.png',
    imageWidth: 486,
    imageHeight: 500,
    marker: Object.freeze({ x: 35, y: 88 }),
    arrowOffset: Object.freeze({ x: 18, y: -8 })
  }),
  bar_harbor: Object.freeze({
    imagePath: 'assets/wind-panels/bar-harbor.png',
    imageWidth: 418,
    imageHeight: 488,
    marker: Object.freeze({ x: 50, y: 52 }),
    arrowOffset: Object.freeze({ x: 18, y: -6 })
  })
});
const WAVE_MODEL_STATUS = Object.freeze({
  OK: 'ok',
  DISABLED: 'disabled',
  MISSING_WAVE_HEIGHT: 'missing-wave-height',
  MISSING_WAVE_PERIOD: 'missing-wave-period',
  MISSING_TIDE: 'missing-tide',
  MISSING_REFERENCE_DEPTH: 'missing-reference-depth',
  STALE_WAVE_DATA: 'stale-wave-data',
  STALE_TIDE_DATA: 'stale-tide-data',
  INVALID_INPUT: 'invalid-input',
  DISPERSION_FAILED: 'dispersion-failed',
  NO_BREAKING_WITHIN_PROFILE: 'no-breaking-within-profile',
  ALREADY_BREAKING_AT_OFFSHORE_BOUNDARY: 'already-breaking-at-offshore-boundary',
  BREAKING_CONTOUR_LANDWARD_OF_LAT: 'breaking-contour-landward-of-lat',
  UNSUPPORTED_BELOW_LAT_GEOMETRY: 'unsupported-below-lat-geometry'
});
const GRAVITY_MPS2 = 9.80665;
const TWO_PI = 2 * Math.PI;
const WAVE_MODEL_LIMITS = Object.freeze({
  minWaveHeightM: 0.01,
  maxWaveHeightM: 15,
  minWavePeriodS: 1,
  maxWavePeriodS: 30,
  minReferenceDepthM: 0.1,
  maxReferenceDepthM: 500,
  waveDataMaxAgeMinutes: 90,
  tideDataMaxAgeMinutes: 30
});
const WAVE_MODEL_CONFIG = Object.freeze({
  belmar: Object.freeze({
    enabled: true,
    profileDatum: 'LAT',
    offshoreSlope: 1 / 50,
    landwardSlope: 1 / 5,
    maxProfileDepthM: 4.0,
    breakerIndexGamma: 0.55,
    tideStationId: '8532337',
    tidePredictionDatum: 'MLLW',
    publishedDatumToLatOffsetM: null,
    allowApproximateDatum: true,
    buoyStationId: '44091',
    proxyUrl: NDBC_WAVES_PROXY_URL,
    offshoreReferenceDepthM: 25,
    shoreNormalDegrees: null,
    profileStepM: 1.0,
    breakDistanceToleranceM: 0.1
  })
});
const BEACHES = [
  {
    id: 'sandy_hook',
    displayName: 'Sandy Hook, NJ',
    lat: 40.4668,
    lon: -74.0093,
    tideStationId: '8531680',
    waterTempSource: Object.freeze({
      provider: 'coops',
      stationId: '8531680',
      label: 'NOAA Sandy Hook'
    }),
    waterQualitySource: Object.freeze({
      provider: 'njdep',
      municipalityIds: Object.freeze([353]),
      maxDistanceMiles: 7,
      locations: Object.freeze([
        Object.freeze({
          id: 'sandy_hook_ocean',
          label: 'Sandy Hook Ocean Beach',
          locationTypes: Object.freeze(['Ocean']),
          beachNames: Object.freeze([
            'Gunnison',
            'Army Rec. Beach North',
            'C Beach',
            'Area C Surf Beach',
            'Area E Visitor Center South',
            'Fort Hancock'
          ])
        }),
        Object.freeze({
          id: 'sandy_hook_bay',
          label: 'Sandy Hook Bay',
          locationTypes: Object.freeze(['Bay']),
          beachNames: Object.freeze([
            'Horseshoe Cove',
            'Spermaceti Cove',
            'Plum Island'
          ])
        })
      ])
    })
  },
  {
    id: 'belmar',
    displayName: 'Belmar, NJ',
    lat: 40.1784,
    lon: -74.0210,
    tideStationId: '8532337',
    waveModelConfigId: 'belmar',
    waterTempSource: Object.freeze({
      provider: 'safeBeachDay',
      label: 'NOAA buoy near Barnegat',
      latitude: 40.1784,
      longitude: -74.0210,
      noaaTidesStation: '8532337',
      ndbcBuoyId: '44091',
      agencyTz: 'America/New_York'
    }),
    altWaterTempSource: Object.freeze({
      provider: 'safeBeachDay',
      label: 'Surfline Belmar',
      latitude: 40.170845,
      longitude: -74.015079,
      noaaTidesStation: '8532337',
      surflineSpotId: '5842041f4e65fad6a7708a01',
      agencyTz: 'America/New_York'
    }),
    waterQualitySource: Object.freeze({
      provider: 'njdep',
      municipalityIds: Object.freeze([328]),
      maxDistanceMiles: 3,
      locations: Object.freeze([
        Object.freeze({
          id: 'belmar_ocean',
          label: 'Belmar Ocean Beach',
          locationTypes: Object.freeze(['Ocean'])
        }),
        Object.freeze({
          id: 'belmar_l_street_bay',
          label: 'L Street Bay',
          locationTypes: Object.freeze(['Bay', 'River']),
          beachNames: Object.freeze(['L Street Beach'])
        })
      ])
    })
  },
  {
    id: 'asbury_park',
    displayName: 'Asbury Park, NJ',
    lat: 40.2204,
    lon: -73.9982,
    tideStationId: '8532337',
    waterTempSource: Object.freeze({
      provider: 'coops',
      stationId: '8532337',
      label: 'NOAA Shark River'
    }),
    waterQualitySource: Object.freeze({
      provider: 'njdep',
      municipalityIds: Object.freeze([325]),
      maxDistanceMiles: 3,
      locations: Object.freeze([
        Object.freeze({
          id: 'asbury_park_ocean',
          label: 'Asbury Park Ocean Beach',
          locationTypes: Object.freeze(['Ocean'])
        })
      ])
    })
  },
  {
    id: 'cape_may',
    displayName: 'Cape May, NJ',
    lat: 38.9351,
    lon: -74.9060,
    tideStationId: '8536110',
    waterTempSource: Object.freeze({
      provider: 'coops',
      stationId: '8536110',
      label: 'NOAA Cape May'
    }),
    waterQualitySource: Object.freeze({
      provider: 'njdep',
      municipalityIds: Object.freeze([172, 173, 176]),
      maxDistanceMiles: 8,
      locations: Object.freeze([
        Object.freeze({
          id: 'cape_may_ocean',
          label: 'Cape May Ocean Beach',
          locationTypes: Object.freeze(['Ocean']),
          beachNames: Object.freeze([
            'Brooklyn',
            'Philadelphia',
            'Queen North',
            'Ocean Ave',
            'Congress',
            'Grant',
            'Broadway',
            '2nd',
            'Brainard'
          ])
        }),
        Object.freeze({
          id: 'cape_may_bay',
          label: 'Cape May Bay',
          locationTypes: Object.freeze(['Bay']),
          beachNames: Object.freeze([
            'Harbor Lane and Bay',
            'Baltimore St and Delaware Ave',
            'Sunset and Bay',
            'New England Road'
          ])
        })
      ])
    })
  },
  {
    id: 'bar_harbor',
    displayName: 'Bar Harbor, ME',
    lat: 44.3876,
    lon: -68.2039,
    tideStationId: '8413320',
    waterTempSource: Object.freeze({
      provider: 'coops',
      stationId: '8413320',
      label: 'NOAA Bar Harbor'
    }),
    waterQualitySource: Object.freeze({
      provider: 'mhb',
      proxyUrl: MAINE_WATER_QUALITY_PROXY_URL
    })
  },
  {
    id: 'kennebunkport',
    displayName: 'Kennebunkport, ME',
    lat: 43.3950,
    lon: -70.4221,
    tideStationId: '8418150',
    waterTempSource: Object.freeze({
      provider: 'coops',
      stationId: '8418150',
      label: 'NOAA Portland'
    }),
    waterQualitySource: Object.freeze({
      provider: 'mhb',
      proxyUrl: MAINE_WATER_QUALITY_PROXY_URL
    })
  },
  {
    id: 'lewes',
    displayName: 'Lewes, DE',
    lat: 38.7854,
    lon: -75.1482,
    tideStationId: '8557380',
    waterTempSource: Object.freeze({
      provider: 'coops',
      stationId: '8557380',
      label: 'NOAA Lewes'
    }),
    waterQualitySource: Object.freeze({
      provider: 'dnrec',
      locations: Object.freeze([
        Object.freeze({
          id: 'lewes_bay',
          label: 'Lewes Bay Beach',
          unitIds: Object.freeze([25025, 25026, 363621, 363697])
        }),
        Object.freeze({
          id: 'cape_henlopen_ocean',
          label: 'Cape Henlopen Ocean Beach',
          unitIds: Object.freeze([290, 303, 351662, 351663])
        })
      ])
    })
  }
];

const beachSelect = document.getElementById('beachSelect');
const useLocationButtonEl = document.getElementById('useLocationButton');
const daySelectorEl = document.getElementById('daySelector');
const statusEl = document.getElementById('status');
const weatherCardTitleEl = document.getElementById('weatherCardTitle');
const airLabelEl = document.getElementById('airLabel');
const windLabelEl = document.getElementById('windLabel');
const airTempEl = document.getElementById('airTemp');
const windEl = document.getElementById('wind');
const weatherUpdatedEl = document.getElementById('weatherUpdated');
const weatherFeelsEl = ensureWeatherFeelsEl();
const weatherRangeEl = ensureWeatherRangeEl();
const waterTempEl = document.getElementById('waterTemp');
const waterUpdatedEl = document.getElementById('waterUpdated');
const offshoreWavesEl = document.getElementById('offshoreWaves');
const estimatedBreakersEl = document.getElementById('estimatedBreakers');
const breakPointEl = document.getElementById('breakPoint');
const waveModelDetailsEl = document.getElementById('waveModelDetails');
const waveModelDetailTextEl = document.getElementById('waveModelDetailText');
const sunriseTimeEl = document.getElementById('sunriseTime');
const sunsetTimeEl = document.getElementById('sunsetTime');
const moonriseTimeEl = document.getElementById('moonriseTime');
const moonsetTimeEl = document.getElementById('moonsetTime');
const windChartEl = document.getElementById('windChart');
const temperatureChartEl = document.getElementById('temperatureChart');
const precipitationChartEl = document.getElementById('precipitationChart');
const radarMapEl = document.getElementById('radarMap');
const radarImageEl = document.getElementById('radarImage');
const radarMarkerEl = document.getElementById('radarMarker');
const radarStatusEl = document.getElementById('radarStatus');
const radarControlsEl = document.getElementById('radarControls');
const radarToggleEl = document.getElementById('radarToggle');
const radarTimeEl = document.getElementById('radarTime');
const radarUpdatedEl = document.getElementById('radarUpdated');
const waterQualityCardEl = document.getElementById('waterQualityCard');
const waterQualityStatusEl = document.getElementById('waterQualityStatus');
const waterQualityDetailsEl = document.getElementById('waterQualityDetails');
const windCardEl = windChartEl.closest('.card');
const windHeadingEl = windCardEl?.querySelector('h2');
const windSummaryEl = ensureWindSummaryEl();
const windDiagramEl = ensureWindDiagramEl();
const windHeadingRowEl = ensureWindHeadingRowEl();
const windVisualsEl = ensureWindVisualsEl();
const tidesTitleEl = document.getElementById('tidesTitle');
const nextTideEl = document.getElementById('nextTide');
const moonPhaseEl = document.getElementById('moonPhase');
const tideListEl = document.getElementById('tideList');
const notesListEl = document.getElementById('notesList');
const LAST_BEACH_KEY = 'beach-app-last-beach';
const LAST_DAY_KEY = 'beach-app-selected-day';
let latestAstronomy = null;
let latestRangePeriods = [];
let latestStrongestDaytimeWindSpeed = null;
let latestWaterQuality = null;
let activeDateKey = getLocalDateKey(getAppNow());
let selectedDayKey = activeDateKey;
let isLocatingBeach = false;
let radarAnimationTimer = null;
let radarFrameData = [];
let radarFrameIndex = 0;
let radarAnimationToken = 0;
let radarIsPaused = false;

// --- Helpers ---
// These are small utilities the rest of the app leans on for wind logic,
// date matching, and lightweight data normalization.
function parseSimulatedNow(value) {
  if (!TEST_MODE || !value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    console.error('Invalid simNow value:', value);
    return null;
  }

  return parsed;
}

function getAppNow() {
  return SIMULATED_NOW ? new Date(SIMULATED_NOW.getTime()) : new Date();
}

function getFixtureParam(source) {
  return TEST_MODE_CONFIG[`${source}Fixture`] || null;
}

function getFixtureUrl(source, fixtureName) {
  return `fixtures/${source}/${fixtureName}.json`;
}

async function loadFixtureJson(source, fixtureName) {
  const response = await fetch(getFixtureUrl(source, fixtureName), {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Fixture load failed for ${source}: ${fixtureName}`);
  }

  return response.json();
}

function getTestModeBannerParts() {
  if (!TEST_MODE) return [];

  const parts = ['Test Mode'];

  if (SIMULATED_NOW) {
    parts.push(`Sim Now: ${formatDateTime(SIMULATED_NOW)}`);
  } else if (TEST_MODE_CONFIG.simNowRaw) {
    parts.push(`Sim Now: invalid (${TEST_MODE_CONFIG.simNowRaw})`);
  }

  [
    ['weather', 'Weather'],
    ['alerts', 'Alerts'],
    ['tides', 'Tides'],
    ['waterTemp', 'Water Temp'],
    ['waves', 'Waves'],
    ['astronomy', 'Astronomy']
  ].forEach(([key, label]) => {
    const fixtureName = getFixtureParam(key);
    if (fixtureName) {
      parts.push(`${label}: ${fixtureName}`);
    }
  });

  testModeErrors.forEach(message => {
    parts.push(message);
  });

  return parts;
}

function renderTestModeBanner() {
  const existing = document.getElementById('testModeBanner');
  if (existing) existing.remove();
  if (!TEST_MODE) return;

  const banner = document.createElement('div');
  banner.id = 'testModeBanner';
  banner.textContent = getTestModeBannerParts().join(' · ');
  banner.style.position = 'sticky';
  banner.style.top = '0';
  banner.style.zIndex = '1000';
  banner.style.padding = '6px 12px';
  banner.style.fontSize = '0.82rem';
  banner.style.fontWeight = '600';
  banner.style.textAlign = 'center';
  banner.style.color = '#92400e';
  banner.style.background = 'rgba(254, 243, 199, 0.95)';
  banner.style.borderBottom = '1px solid rgba(217, 119, 6, 0.18)';
  banner.style.backdropFilter = 'blur(6px)';
  document.body.prepend(banner);
}

function clearTestModeErrors() {
  if (!TEST_MODE) return;
  testModeErrors.length = 0;
  renderTestModeBanner();
}

function addTestModeError(message) {
  if (!TEST_MODE || !message) return;
  if (!testModeErrors.includes(message)) {
    testModeErrors.push(message);
  }
  renderTestModeBanner();
}

function dirToDeg(dir) {
  const map = {
    N: 0, NE: 45, E: 90, SE: 135,
    S: 180, SW: 225, W: 270, NW: 315
  };
  return map[dir] ?? null;
}

function isOnshore(deg) {
  return deg >= 45 && deg <= 135;
}

function findWindShift(hours) {
  if (!hours || hours.length < 2) return null;

  const threshold = 60;

  const startDeg = dirToDeg(hours[0].windDirection);
  if (startDeg == null) return null;

  for (let i = 1; i < hours.length; i++) {
    const nextDeg = dirToDeg(hours[i].windDirection);
    if (nextDeg == null) continue;

    let diff = Math.abs(nextDeg - startDeg);
    if (diff > 180) diff = 360 - diff;

    if (diff >= threshold) {
      return hours[i];
    }
  }

  return null;
}

let latestHourlyPeriods = [];
let latestAlerts = [];

// Beach Notes are intentionally short and prioritized. Each note builder
// returns either null or an object with `{ text, priority }`.
function windShiftNote(hours) {
  const shift = findWindShift(hours);
  if (!shift) return null;

  const startDeg = dirToDeg(hours[0].windDirection);
  const newDeg = dirToDeg(shift.windDirection);

  if (startDeg == null || newDeg == null) return null;

  const fromOnshore = isOnshore(startDeg);
  const toOnshore = isOnshore(newDeg);

  let phrase;

  if (!fromOnshore && toOnshore) {
    phrase = "Wind turning onshore";
  } else if (fromOnshore && !toOnshore) {
    phrase = "Wind turning offshore";
  } else {
const dirText = degToCardinal(newDeg);
phrase = `Wind shifting ${dirText}`;
  }

  const now = getAppNow();
  const shiftTime = new Date(shift.startTime);
  const diff = shiftTime - now;

  let timeText;

  if (diff <= 60 * 60 * 1000) {
    timeText = "soon";
  } else {
    timeText = "around " + shiftTime.toLocaleTimeString([], { hour: 'numeric' });
  }

  return {
    text: `${phrase} ${timeText}`,
    priority: 4
  };
}

function degToCardinal(deg) {
  if (deg == null) return '';

  const dirs = ['northerly', 'northeasterly', 'easterly', 'southeasterly',
                'southerly', 'southwesterly', 'westerly', 'northwesterly'];

  const index = Math.round(deg / 45) % 8;
  return dirs[index];
}

function getPrecipSeverity(text) {
  if (!text) return null;

  const t = text.toLowerCase();

  if (t.includes("thunder")) return "Thunderstorms";
  if (t.includes("heavy")) return "Heavy rain";
  if (t.includes("rain") || t.includes("showers")) return "Rain";
  if (t.includes("drizzle") || t.includes("light")) return "Light rain";

  return null;
}

function precipitationNote(hours) {
  if (!hours || hours.length === 0) return null;

  const threshold = 30;
  const now = getAppNow();

  let best = null;

  for (const h of hours) {
    const forecastTime = new Date(h.startTime);
    if (Number.isNaN(forecastTime.getTime())) continue;
    const precipProbability = getValidPrecipProbability(h);
    if (precipProbability == null) continue;
    if (precipProbability < threshold) continue;

    const severity = getPrecipSeverity(h.shortForecast);
    if (!severity) continue;

    if (!best || rankSeverity(severity) > rankSeverity(best.severity)) {
      best = {
        severity,
        time: forecastTime
      };
    }
  }

  if (!best) return null;

  const diff = best.time - now;
  const priority = getPrecipitationNotePriority(best.severity);

  if (diff <= 60 * 60 * 1000) {
    return {
      text: `${best.severity} likely soon`,
      priority,
      severity: best.severity
    };
  }

  const timeText = "after " + best.time.toLocaleTimeString([], { hour: 'numeric' });
  return {
    text: `${best.severity} possible ${timeText}`,
    priority,
    severity: best.severity
  };
}

function getValidPrecipProbability(period) {
  const value = period?.probabilityOfPrecipitation?.value;
  return Number.isFinite(value) ? value : null;
}

function rankSeverity(severity) {
  return {
    "Thunderstorms": 4,
    "Heavy rain": 3,
    "Rain": 2,
    "Light rain": 1
  }[severity] || 0;
}

function getPrecipitationNotePriority(severity) {
  return {
    "Thunderstorms": 1,
    "Heavy rain": 2,
    "Rain": 3,
    "Light rain": 5
  }[severity] || 4;
}

function breakfastNote(beach, date = getAppNow()) {
  if (!isSameLocalDay(date, getAppNow())) return null;

  const now = getAppNow();
  if (now.getHours() >= 10) return null;

  const day = now.getDay();
  if (day === 5) {
    return {
      text: 'Dunkin Donuts day',
      priority: 9
    };
  }

  if (day === 6) {
    return {
      text: 'Bagel day',
      priority: 9
    };
  }

  if (isNewJerseyBeach(beach) && shouldShowPorkRollNote(beach, now)) {
    return {
      text: 'Pork roll, egg & cheese?',
      priority: 9
    };
  }

  return null;
}

function isNewJerseyBeach(beach) {
  return String(beach?.displayName || '').endsWith(', NJ');
}

function shouldShowPorkRollNote(beach, date) {
  const key = `${beach?.id || 'beach'}-${getLocalDateKey(date)}`;
  return hashStringToUnitInterval(key) < 0.14;
}

function hashStringToUnitInterval(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function renderNotes(notes) {
  if (!notes || notes.length === 0) {
    notesListEl.innerHTML = '<li>No special notes</li>';
    return;
  }

  notesListEl.innerHTML = notes
    .map(note => `<li title="${note.text}">${note.text}</li>`)
    .join('');
}

function buildBeachNotes(data) {
  const precipitation = precipitationNote(data.hourly);
  const notes = [
    waterQualityNote(data.waterQuality, data.isToday),
    data.isToday ? ripCurrentNote(data.alerts) : null,
    windShiftNote(data.hourly),
    precipitation,
    sealNote(data.beach, data.current, precipitation, data.date),
    clothingNote(data.date, data.range, data.strongestWindSpeed, data.hourly),
    fullMoonRiseNote(data.astronomy),
    breakfastNote(data.beach, data.date)
  ]
    .flatMap(note => Array.isArray(note) ? note : [note])
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  return notes;
}

// The day selector always represents a rolling 7-day planning window.
// "Today" stays anchored unless the saved selection falls out of range.
function getSelectableDates(baseDate = getAppNow()) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function restoreSelectedDay() {
  const validKeys = new Set(getSelectableDates().map(getLocalDateKey));
  const saved = localStorage.getItem(LAST_DAY_KEY);
  selectedDayKey = validKeys.has(saved) ? saved : getLocalDateKey(getAppNow());
}

function getSelectedDate() {
  return getSelectableDates().find(date => getLocalDateKey(date) === selectedDayKey) || getSelectableDates()[0];
}

function isTodaySelected() {
  return selectedDayKey === getLocalDateKey(getAppNow());
}

function renderDaySelector() {
  const dates = getSelectableDates();
  daySelectorEl.innerHTML = dates.map((date, index) => {
    const dateKey = getLocalDateKey(date);
    const label = index === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' });
    const isSelected = dateKey === selectedDayKey;
    return `
      <button class="day-button${isSelected ? ' is-selected' : ''}" type="button" data-date-key="${dateKey}" aria-pressed="${isSelected}">
        <strong>${label}</strong>
        <span>${formatShortDate(date)}</span>
      </button>
    `;
  }).join('');
}

function setSelectedDay(dateKey, { persist = true, reload = true } = {}) {
  const validKeys = new Set(getSelectableDates().map(getLocalDateKey));
  selectedDayKey = validKeys.has(dateKey) ? dateKey : getLocalDateKey(getAppNow());
  renderDaySelector();
  if (persist) localStorage.setItem(LAST_DAY_KEY, selectedDayKey);
  if (reload) loadBeach();
}

function setUseLocationButtonState(isLoading) {
  isLocatingBeach = isLoading;
  if (!useLocationButtonEl) return;
  useLocationButtonEl.disabled = isLoading;
  useLocationButtonEl.textContent = '📍';
  useLocationButtonEl.setAttribute('aria-label', isLoading ? 'Finding your location' : 'Use My Location');
  useLocationButtonEl.setAttribute('title', isLoading ? 'Finding your location' : 'Use My Location');
}

function getDistanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = value => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function getNearestBeach(lat, lon) {
  return BEACHES.reduce((closest, beach) => {
    const distanceMiles = getDistanceMiles(lat, lon, beach.lat, beach.lon);
    if (!closest || distanceMiles < closest.distanceMiles) {
      return { beach, distanceMiles };
    }
    return closest;
  }, null);
}

function handleUseMyLocation() {
  if (!navigator.geolocation) {
    statusEl.textContent = 'Location is not supported on this device.';
    return;
  }
  if (isLocatingBeach) return;

  setUseLocationButtonState(true);
  statusEl.textContent = 'Finding your nearest beach…';

  navigator.geolocation.getCurrentPosition(position => {
    const nearest = getNearestBeach(position.coords.latitude, position.coords.longitude);
    setUseLocationButtonState(false);

    if (!nearest?.beach) {
      statusEl.textContent = 'Could not determine the nearest beach.';
      return;
    }

    beachSelect.value = nearest.beach.id;
    localStorage.setItem(LAST_BEACH_KEY, nearest.beach.id);
    statusEl.textContent = `Nearest beach: ${nearest.beach.displayName}`;
    setSelectedDay(selectedDayKey, { persist: true, reload: true });
  }, error => {
    setUseLocationButtonState(false);

    const message = error?.code === error.PERMISSION_DENIED
      ? 'Location permission was denied.'
      : error?.code === error.POSITION_UNAVAILABLE
        ? 'Your location is currently unavailable.'
        : error?.code === error.TIMEOUT
          ? 'Location request timed out.'
          : 'Could not determine your location.';
    statusEl.textContent = message;
  }, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000
  });
}

function init() {
  // Initial page setup: wire the selector UI, restore saved state,
  // then load the selected beach/day combination.
  addVersionTag();
  renderTestModeBanner();
  ensureTideChartContainer();
  startDateRolloverWatcher();

  BEACHES.forEach(beach => {
    const option = document.createElement('option');
    option.value = beach.id;
    option.textContent = beach.displayName;
    beachSelect.appendChild(option);
  });

  const savedBeach = normalizeBeachId(localStorage.getItem(LAST_BEACH_KEY));
  if (savedBeach && BEACHES.some(b => b.id === savedBeach)) {
    beachSelect.value = savedBeach;
  }

  restoreSelectedDay();
  renderDaySelector();

  if (!beachSelect.value) {
    beachSelect.value = BEACHES[0].id;
  }

  beachSelect.addEventListener('change', () => {
    localStorage.setItem(LAST_BEACH_KEY, beachSelect.value);
    setSelectedDay(selectedDayKey, { persist: true, reload: true });
  });

  useLocationButtonEl?.addEventListener('click', handleUseMyLocation);
  radarToggleEl?.addEventListener('click', toggleRadarAnimation);

  daySelectorEl.addEventListener('click', event => {
    const button = event.target.closest('.day-button');
    if (!button) return;
    setSelectedDay(button.dataset.dateKey, { persist: true, reload: true });
  });

  loadBeach();
}

function normalizeBeachId(value) {
  if (value === 'sandy-hook') return 'sandy_hook';
  return value;
}

function addVersionTag() {
  const title = document.querySelector('.header h1');
  if (!title) return;

  const existing = document.getElementById('versionTag');
  if (existing) existing.remove();

  const version = document.createElement('span');
  version.id = 'versionTag';
  version.textContent = APP_VERSION;
  version.style.marginLeft = '10px';
  version.style.fontSize = '0.8rem';
  version.style.fontWeight = '600';
  version.style.padding = '0.2rem 0.45rem';
  version.style.borderRadius = '999px';
  version.style.background = '#dbeafe';
  version.style.color = '#1e3a8a';
  version.style.verticalAlign = 'middle';
  title.appendChild(version);
}

function ensureTideChartContainer() {
  let chartWrap = document.getElementById('tideChartWrap');
  if (chartWrap) return;

  chartWrap = document.createElement('div');
  chartWrap.id = 'tideChartWrap';
  chartWrap.style.margin = '14px 0 18px';

  const label = document.createElement('div');
  label.textContent = 'Tide Curve';
  label.style.fontSize = '0.95rem';
  label.style.fontWeight = '600';
  label.style.marginBottom = '8px';
  label.style.color = '#334155';

  const chart = document.createElement('div');
  chart.id = 'tideChart';
  chart.style.width = '100%';
  chart.style.minHeight = '0';
  chart.style.border = '1px solid #e2e8f0';
  chart.style.borderRadius = '14px';
  chart.style.padding = '8px';
  chart.style.boxSizing = 'border-box';
  chart.style.background = '#f8fafc';

  chartWrap.appendChild(label);
  chartWrap.appendChild(chart);
  nextTideEl.insertAdjacentElement('afterend', chartWrap);
}

function ensureWeatherFeelsEl() {
  let feelsEl = document.getElementById('weatherFeels');
  if (feelsEl) return feelsEl;

  feelsEl = document.createElement('div');
  feelsEl.id = 'weatherFeels';
  feelsEl.className = 'updated';
  feelsEl.style.marginTop = '10px';
  feelsEl.style.marginBottom = '0';
  weatherUpdatedEl.insertAdjacentElement('beforebegin', feelsEl);
  return feelsEl;
}

function ensureWeatherRangeEl() {
  let rangeEl = document.getElementById('weatherRange');
  if (rangeEl) return rangeEl;

  rangeEl = document.createElement('div');
  rangeEl.id = 'weatherRange';
  rangeEl.className = 'updated';
  rangeEl.style.marginTop = '6px';
  rangeEl.setAttribute('aria-live', 'polite');
  weatherUpdatedEl.insertAdjacentElement('afterend', rangeEl);
  return rangeEl;
}

function ensureWindSummaryEl() {
  let summaryEl = document.getElementById('windSummary');
  if (summaryEl) return summaryEl;

  summaryEl = document.createElement('div');
  summaryEl.id = 'windSummary';
  summaryEl.className = 'updated wind-summary';
  summaryEl.setAttribute('aria-live', 'polite');
  windChartEl.insertAdjacentElement('beforebegin', summaryEl);
  return summaryEl;
}

function ensureWindDiagramEl() {
  let diagramEl = document.getElementById('windDiagram');
  if (diagramEl) return diagramEl;

  diagramEl = document.createElement('div');
  diagramEl.id = 'windDiagram';
  diagramEl.className = 'wind-diagram';
  windChartEl.insertAdjacentElement('beforebegin', diagramEl);
  return diagramEl;
}

function ensureWindVisualsEl() {
  let visualsEl = document.getElementById('windVisuals');
  if (visualsEl) return visualsEl;

  visualsEl = document.createElement('div');
  visualsEl.id = 'windVisuals';
  visualsEl.className = 'wind-visuals';
  windSummaryEl.insertAdjacentElement('beforebegin', visualsEl);
  visualsEl.appendChild(windSummaryEl);
  visualsEl.appendChild(windChartEl);
  return visualsEl;
}

function ensureWindHeadingRowEl() {
  let headingRowEl = document.getElementById('windHeadingRow');
  if (headingRowEl) return headingRowEl;
  if (!windCardEl || !windHeadingEl) return null;

  headingRowEl = document.createElement('div');
  headingRowEl.id = 'windHeadingRow';
  headingRowEl.className = 'wind-heading-row';
  windHeadingEl.insertAdjacentElement('beforebegin', headingRowEl);
  headingRowEl.appendChild(windHeadingEl);
  headingRowEl.appendChild(windDiagramEl);
  return headingRowEl;
}

function getSelectedBeach() {
  return BEACHES.find(b => b.id === beachSelect.value) || BEACHES[0];
}

async function loadBeach() {
  // This is the app's main orchestration step. Everything on screen should
  // reflect one coherent combination of selected beach + selected day.
  clearTestModeErrors();
  const beach = getSelectedBeach();
  const selectedDate = getSelectedDate();
  statusEl.textContent = `Loading ${beach.displayName}…`;
  tidesTitleEl.textContent = isSameLocalDay(selectedDate, getAppNow())
    ? 'Tides Today'
    : `Tides ${formatShortDate(selectedDate)}`;
  latestAstronomy = calculateAstronomy(beach, selectedDate);
  renderAstronomy(latestAstronomy);
  renderRadar(beach);
  latestWaterQuality = null;
  renderWaterQualityLoading(beach);

  const results = await Promise.allSettled([
    loadWeather(beach, selectedDate),
    loadTides(beach, selectedDate),
    loadWaterTemp(beach, selectedDate),
    loadAlerts(beach),
    loadWaterQuality(beach, selectedDate)
  ]);

  const noteHours = getNotePeriodsForDate(latestHourlyPeriods, selectedDate);
  const rangePeriods = latestRangePeriods.length ? latestRangePeriods : latestHourlyPeriods;
  const notes = buildBeachNotes({
    beach,
    current: getSummaryPeriod(latestHourlyPeriods, selectedDate),
    hourly: noteHours,
    alerts: latestAlerts,
    astronomy: latestAstronomy,
    date: selectedDate,
    isToday: isSameLocalDay(selectedDate, getAppNow()),
    waterQuality: latestWaterQuality,
    range: findDailyTemperatureRange(rangePeriods, selectedDate),
    strongestWindSpeed: latestStrongestDaytimeWindSpeed
  });
  renderNotes(notes);

  moonPhaseEl.textContent = `Moon: ${getMoonPhase(latestAstronomy?.date || getAppNow())}`;

  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length) {
    failed.forEach(result => console.error(result.reason));
    statusEl.textContent = 'Some data failed to load. Try refresh.';
    return;
  }

  statusEl.textContent = `${beach.displayName} updated.`;
}

function startDateRolloverWatcher() {
  window.setInterval(() => {
    const nextDateKey = getLocalDateKey(getAppNow());
    if (nextDateKey === activeDateKey) return;
    activeDateKey = nextDateKey;
    const validKeys = new Set(getSelectableDates().map(getLocalDateKey));
    if (!validKeys.has(selectedDayKey)) {
      selectedDayKey = activeDateKey;
      localStorage.setItem(LAST_DAY_KEY, selectedDayKey);
    }
    renderDaySelector();
    loadBeach();
  }, 60 * 1000);
}

function getForecastPeriodsForDate(periods, selectedDate) {
  if (!Array.isArray(periods)) return [];
  return periods.filter(period => isSameLocalDay(period.startTime, selectedDate));
}

// Notes should reflect relevant planning hours:
// - Today: only remaining hours
// - Future days: only the 6 AM to 6 PM daytime window
function getNotePeriodsForDate(periods, selectedDate) {
  const dayPeriods = getForecastPeriodsForDate(periods, selectedDate);
  if (!dayPeriods.length) return [];
  if (!isSameLocalDay(selectedDate, getAppNow())) {
    return dayPeriods.filter(period => isDaytimeForecastHour(period.startTime, selectedDate));
  }

  const now = getAppNow();
  return dayPeriods.filter(period => {
    const start = new Date(period.startTime);
    if (Number.isNaN(start.getTime())) return false;
    const end = period.endTime ? new Date(period.endTime) : new Date(start.getTime() + 60 * 60 * 1000);
    return start >= now || end > now;
  });
}

function getSummaryPeriod(periods, selectedDate) {
  // "Now" is only meaningful for Today. Future days use a representative
  // daytime forecast nearest noon so the summary feels stable and intuitive.
  const dayPeriods = getForecastPeriodsForDate(periods, selectedDate);
  if (!dayPeriods.length) return null;

  if (isSameLocalDay(selectedDate, getAppNow())) {
    return periods?.[0] || dayPeriods[0];
  }

  const target = new Date(selectedDate);
  target.setHours(12, 0, 0, 0);
  const daytimePeriods = dayPeriods.filter(period => isDaytimeForecastHour(period.startTime, selectedDate));
  const pool = daytimePeriods.length ? daytimePeriods : dayPeriods;

  return pool.reduce((closest, period) => {
    if (!closest) return period;
    const diff = Math.abs(new Date(period.startTime) - target);
    const closestDiff = Math.abs(new Date(closest.startTime) - target);
    return diff < closestDiff ? period : closest;
  }, null);
}

function getStrongestDaytimeWind(periods, selectedDate) {
  const daytimePeriods = getRangeCandidates(periods, selectedDate);
  if (!daytimePeriods.length) return null;

  return daytimePeriods.reduce((strongest, period) => {
    const speed = parseWindSpeed(period.windSpeed);
    if (!Number.isFinite(speed)) return strongest;
    if (!strongest || speed > strongest.speed) {
      return {
        speed,
        period
      };
    }
    return strongest;
  }, null);
}

function getGridTemperaturePeriods(values, selectedDate) {
  // NWS hourly forecasts may not include earlier hours by late afternoon.
  // Grid data lets us rebuild the full daytime range for the selected day.
  if (!Array.isArray(values)) return [];

  return values.flatMap(entry => {
    if (!Number.isFinite(entry?.value)) return [];

    const interval = parseValidTimeInterval(entry.validTime);
    if (!interval) return [];

    const points = [];
    const hourMs = 60 * 60 * 1000;
    const endTime = Math.max(interval.start.getTime() + hourMs, interval.end.getTime());

    for (let ts = interval.start.getTime(); ts < endTime; ts += hourMs) {
      const time = new Date(ts);
      if (!isSameLocalDay(time, selectedDate)) continue;
      points.push({
        startTime: time.toISOString(),
        temperature: convertCelsiusToFahrenheit(entry.value)
      });
    }

    return points;
  });
}

function parseValidTimeInterval(validTime) {
  if (typeof validTime !== 'string' || !validTime.includes('/')) return null;

  const [startText, durationText] = validTime.split('/');
  const start = new Date(startText);
  if (Number.isNaN(start.getTime())) return null;

  const durationMs = parseIsoDurationMs(durationText);
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;

  return {
    start,
    end: new Date(start.getTime() + durationMs)
  };
}

function parseIsoDurationMs(durationText) {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(durationText || '');
  if (!match) return null;

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return (((days * 24) + hours) * 60 + minutes) * 60 * 1000;
}

function convertCelsiusToFahrenheit(value) {
  return Math.round(((value * 9) / 5) + 32);
}

function getGridWindPeriods(values, selectedDate) {
  // The wind chart and clothing note both benefit from a full-day daytime
  // window, so we expand grid intervals into hourly points when possible.
  if (!Array.isArray(values)) return [];

  return values.flatMap(entry => {
    if (!Number.isFinite(entry?.value)) return [];

    const interval = parseValidTimeInterval(entry.validTime);
    if (!interval) return [];

    const points = [];
    const hourMs = 60 * 60 * 1000;
    const endTime = Math.max(interval.start.getTime() + hourMs, interval.end.getTime());

    for (let ts = interval.start.getTime(); ts < endTime; ts += hourMs) {
      const time = new Date(ts);
      if (!isSameLocalDay(time, selectedDate)) continue;
      if (!isDaytimeForecastHour(time, selectedDate)) continue;
      points.push({
        startTime: time.toISOString(),
        windSpeedMph: convertWindToMph(entry.value, entry.unitCode)
      });
    }

    return points;
  });
}

function convertWindToMph(value, unitCode = '') {
  const unit = String(unitCode).toLowerCase();
  if (unit.includes('km_h-1') || unit.includes('km/h')) return Math.round(value * 0.621371);
  if (unit.includes('kn')) return Math.round(value * 1.15078);
  return Math.round(value);
}

function getGridWindDirectionPeriods(values, selectedDate) {
  if (!Array.isArray(values)) return [];

  return values.flatMap(entry => {
    const directionDeg = parseWindDirectionValue(entry?.value);
    if (!Number.isFinite(directionDeg)) return [];

    const interval = parseValidTimeInterval(entry.validTime);
    if (!interval) return [];

    const points = [];
    const hourMs = 60 * 60 * 1000;
    const endTime = Math.max(interval.start.getTime() + hourMs, interval.end.getTime());

    for (let ts = interval.start.getTime(); ts < endTime; ts += hourMs) {
      const time = new Date(ts);
      if (!isSameLocalDay(time, selectedDate)) continue;
      if (!isDaytimeForecastHour(time, selectedDate)) continue;
      points.push({
        startTime: time.toISOString(),
        directionDeg
      });
    }

    return points;
  });
}

function parseWindDirectionValue(value) {
  if (Number.isFinite(value)) return ((value % 360) + 360) % 360;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return dirToDeg(normalized);
}

function getStrongestDaytimeWindSpeed(gridWindPeriods, hourlyPeriods, selectedDate) {
  const gridMax = gridWindPeriods.reduce((max, period) => {
    return Number.isFinite(period.windSpeedMph) ? Math.max(max, period.windSpeedMph) : max;
  }, -Infinity);
  if (Number.isFinite(gridMax) && gridMax > -Infinity) return gridMax;

  return getStrongestDaytimeWind(hourlyPeriods, selectedDate)?.speed ?? null;
}

function getWindChartPeriods(gridWindPeriods, gridDirectionPeriods, hourlyPeriods, selectedDate) {
  // Prefer grid data for complete daytime coverage, but fall back to the
  // hourly forecast feed so the chart still renders when grid fields are thin.
  const map = new Map();

  gridWindPeriods.forEach(period => {
    const key = period.startTime;
    map.set(key, {
      startTime: period.startTime,
      speed: period.windSpeedMph,
      directionDeg: map.get(key)?.directionDeg ?? null
    });
  });

  gridDirectionPeriods.forEach(period => {
    const key = period.startTime;
    const existing = map.get(key) || { startTime: period.startTime, speed: null, directionDeg: null };
    existing.directionDeg = period.directionDeg;
    map.set(key, existing);
  });

  if (!map.size) {
    getForecastPeriodsForDate(hourlyPeriods, selectedDate)
      .filter(period => isDaytimeForecastHour(period.startTime, selectedDate))
      .forEach(period => {
        const speed = parseWindSpeed(period.windSpeed);
        if (!Number.isFinite(speed)) return;
        map.set(period.startTime, {
          startTime: period.startTime,
          speed,
          directionDeg: parseWindDirectionValue(period.windDirection)
        });
      });
  }

  return [...map.values()]
    .filter(period => Number.isFinite(period.speed))
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

function getTemperatureChartPeriods(gridTemperaturePeriods, hourlyPeriods, selectedDate) {
  const map = new Map();

  gridTemperaturePeriods.forEach(period => {
    if (!Number.isFinite(period?.temperature)) return;
    if (!isDaytimeForecastHour(period.startTime, selectedDate)) return;
    map.set(period.startTime, {
      startTime: period.startTime,
      temperature: period.temperature
    });
  });

  if (!map.size) {
    getForecastPeriodsForDate(hourlyPeriods, selectedDate)
      .filter(period => isDaytimeForecastHour(period.startTime, selectedDate))
      .forEach(period => {
        if (!Number.isFinite(period?.temperature)) return;
        map.set(period.startTime, {
          startTime: period.startTime,
          temperature: period.temperature
        });
      });
  }

  return [...map.values()].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

function getPrecipitationChartPeriods(hourlyPeriods, selectedDate) {
  return getForecastPeriodsForDate(hourlyPeriods, selectedDate)
    .filter(period => isDaytimeForecastHour(period.startTime, selectedDate))
    .map(period => {
      const value = period?.probabilityOfPrecipitation?.value;
      return {
        startTime: period.startTime,
        precipitationProbability: Number.isFinite(value) ? value : null
      };
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

function getDayChartLayout(selectedDate) {
  const width = 640;
  const height = 232;
  const isPhone = window.innerWidth <= 600;
  const fontSmall = isPhone ? 24 : 11;
  const fontMedium = isPhone ? 18 : 10;
  const pad = { top: 24, right: 12, bottom: 34, left: isPhone ? 68 : 40 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const axisStart = new Date(selectedDate);
  axisStart.setHours(6, 0, 0, 0);
  const axisEnd = new Date(selectedDate);
  axisEnd.setHours(18, 0, 0, 0);
  const labelHours = [6, 8, 10, 12, 14, 16, 18];
  const hourSpan = Math.max(1, (axisEnd.getTime() - axisStart.getTime()) / (60 * 60 * 1000));

  return {
    width,
    height,
    fontSmall,
    fontMedium,
    pad,
    innerWidth,
    innerHeight,
    axisStart,
    axisEnd,
    labelHours,
    getXForTime(value) {
      const time = new Date(value).getTime();
      const progress = (time - axisStart.getTime()) / Math.max(1, axisEnd.getTime() - axisStart.getTime());
      return pad.left + Math.max(0, Math.min(1, progress)) * innerWidth;
    },
    getBarWidth() {
      return (innerWidth / hourSpan) * 0.72;
    },
    getWindBarWidth() {
      return (innerWidth / hourSpan) * 0.62;
    },
    getHourSlotWidth() {
      return innerWidth / hourSpan;
    },
    getXForHour(hour) {
      const progress = (hour - 6) / hourSpan;
      return pad.left + Math.max(0, Math.min(1, progress)) * innerWidth;
    },
    getTimeLabelText(hour) {
      const dt = new Date(axisStart);
      dt.setHours(hour, 0, 0, 0);
      return formatCompactHour(dt);
    },
    getNowX(now = getAppNow()) {
      if (now < axisStart || now > axisEnd) return null;
      const progress = (now.getTime() - axisStart.getTime()) / Math.max(1, axisEnd.getTime() - axisStart.getTime());
      return pad.left + Math.max(0, Math.min(1, progress)) * innerWidth;
    },
    getBarCenterForTime(value) {
      return this.getXForTime(value) + this.getHourSlotWidth() / 2;
    }
  };
}

function renderChartNowLine(layout, selectedDate) {
  if (!isSameLocalDay(selectedDate, getAppNow())) return '';

  const x = layout.getNowX(getAppNow());
  if (x === null) return '';

  return `<line x1="${x.toFixed(1)}" y1="${layout.pad.top}" x2="${x.toFixed(1)}" y2="${layout.height - layout.pad.bottom}" stroke="#ef4444" stroke-width="2" stroke-dasharray="5 4" />
<text x="${Math.min(layout.width - 28, x + 6).toFixed(1)}" y="${layout.pad.top + 12}" font-size="${layout.fontSmall}" fill="#b91c1c">Now</text>`;
}

function renderChartTimeLabels(layout) {
  return layout.labelHours.map(hour => {
    const x = layout.getXForHour(hour);
    return `<text x="${x.toFixed(1)}" y="${layout.height - 10}" text-anchor="middle" font-size="${layout.fontSmall}" fill="#64748b">${layout.getTimeLabelText(hour)}</text>`;
  }).join('');
}

function renderTemperatureChart(periods, beach, selectedDate) {
  if (!periods.length) {
    temperatureChartEl.textContent = 'Temperature chart unavailable.';
    return;
  }

  const layout = getDayChartLayout(selectedDate);
  const temps = periods.map(period => period.temperature).filter(Number.isFinite);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const spread = Math.max(4, maxTemp - minTemp);
  const chartMin = Math.floor((minTemp - spread * 0.15) / 2) * 2;
  const chartMax = Math.ceil((maxTemp + spread * 0.15) / 2) * 2;
  const y = temp => layout.pad.top + layout.innerHeight - ((temp - chartMin) / Math.max(1, chartMax - chartMin)) * layout.innerHeight;
  const highIndex = periods.findIndex(period => period.temperature === maxTemp);
  const lowIndex = periods.findIndex(period => period.temperature === minTemp);
  const yLabels = [chartMin, Math.round((chartMin + chartMax) / 2), chartMax];
  const yGrid = yLabels.map(value => `
    <line x1="${layout.pad.left}" y1="${y(value).toFixed(1)}" x2="${layout.width - layout.pad.right}" y2="${y(value).toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />
    <text x="${layout.pad.left - 10}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end" font-size="${layout.fontSmall}" fill="#64748b">${value}°</text>
  `).join('');
  const linePath = periods.map((period, index) => `${index === 0 ? 'M' : 'L'} ${layout.getXForTime(period.startTime).toFixed(1)} ${y(period.temperature).toFixed(1)}`).join(' ');
  const points = periods.map((period, index) => {
    const cx = layout.getXForTime(period.startTime);
    const cy = y(period.temperature);
    const isHigh = index === highIndex;
    const isLow = index === lowIndex;
    return `
      <g>
        <title>${formatTimeNoSeconds(period.startTime)}, ${period.temperature}°F</title>
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${isHigh || isLow ? 3.2 : 2.2}" fill="${isHigh ? '#dc2626' : isLow ? '#2563eb' : '#0f766e'}" />
      </g>
    `;
  }).join('');
  const extremaLabels = periods.map((period, index) => {
    if (index !== highIndex && index !== lowIndex) return '';
    const cx = layout.getXForTime(period.startTime);
    const cy = y(period.temperature);
    const label = index === highIndex ? 'High' : 'Low';
    const labelY = index === highIndex ? cy - 10 : cy + 14;
    return `<text x="${cx.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="${layout.fontMedium}" font-weight="600" fill="${index === highIndex ? '#b91c1c' : '#1d4ed8'}">${label}</text>`;
  }).join('');
  const timeLabels = renderChartTimeLabels(layout);
  const nowLine = renderChartNowLine(layout, selectedDate);
  const aria = `Temperature chart for ${beach.displayName} on ${formatLongDate(selectedDate)} showing daytime hourly temperatures from 6 AM to 6 PM.`;

  temperatureChartEl.innerHTML = `
    <svg viewBox="0 0 ${layout.width} ${layout.height}" style="width:100%;height:auto;display:block;" role="img" aria-label="${aria}">
      ${yGrid}
      <path d="${linePath}" fill="none" stroke="#0f766e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${points}
      ${extremaLabels}
      ${nowLine}
      ${timeLabels}
    </svg>
  `;
}

function renderPrecipitationChart(periods, beach, selectedDate) {
  const numericPeriods = periods.filter(period => Number.isFinite(period.precipitationProbability));
  if (!periods.length || !numericPeriods.length) {
    precipitationChartEl.textContent = 'Precipitation chart unavailable.';
    return;
  }

  const layout = getDayChartLayout(selectedDate);
  const chartMax = 100;
  const y = value => layout.pad.top + layout.innerHeight - (value / chartMax) * layout.innerHeight;
  const yLabels = [0, 50, 100];
  const yGrid = yLabels.map(value => `
    <line x1="${layout.pad.left}" y1="${y(value).toFixed(1)}" x2="${layout.width - layout.pad.right}" y2="${y(value).toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />
    <text x="${layout.pad.left - 10}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end" font-size="${layout.fontSmall}" fill="#64748b">${value}%</text>
  `).join('');
  const barWidth = layout.getBarWidth();
  const bars = periods.map(period => {
    if (!Number.isFinite(period.precipitationProbability)) return '';
    const x = layout.getBarCenterForTime(period.startTime) - barWidth / 2;
    const top = y(period.precipitationProbability);
    const barHeight = layout.innerHeight - (top - layout.pad.top);
    return `
      <g>
        <title>${formatTimeNoSeconds(period.startTime)}, ${period.precipitationProbability}% chance of precipitation</title>
        <rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="4" fill="#93c5fd" />
      </g>
    `;
  }).join('');
  const timeLabels = renderChartTimeLabels(layout);
  const nowLine = renderChartNowLine(layout, selectedDate);
  const aria = `Precipitation chart for ${beach.displayName} on ${formatLongDate(selectedDate)} showing daytime hourly precipitation chances from 6 AM to 6 PM.`;

  precipitationChartEl.innerHTML = `
    <svg viewBox="0 0 ${layout.width} ${layout.height}" style="width:100%;height:auto;display:block;" role="img" aria-label="${aria}">
      ${yGrid}
      ${bars}
      ${nowLine}
      ${timeLabels}
    </svg>
  `;
}

function renderWindChart(periods, beach, selectedDate) {
  if (!periods.length) {
    windSummaryEl.textContent = '';
    renderWindDiagram(beach, null, selectedDate);
    windChartEl.textContent = 'Wind chart unavailable.';
    return;
  }

  // The chart is intentionally simple: one daytime bar per hour, a direction
  // arrow above each bar, and a highlight for the first strongest-wind hour.
  const layout = getDayChartLayout(selectedDate);
  const width = layout.width;
  const height = layout.height;
  const fontSmall = layout.fontSmall;
  const fontMedium = layout.fontMedium;
  const pad = { ...layout.pad, top: 48 };
  const maxSpeed = Math.max(...periods.map(period => period.speed));
  const chartMax = Math.max(10, Math.ceil(maxSpeed / 5) * 5);
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const barWidth = layout.getWindBarWidth();
  const maxIndex = periods.findIndex(period => period.speed === maxSpeed);
  const summary = getWindTrendSummary(periods);
  const peakPeriod = periods[maxIndex] || null;
  windSummaryEl.textContent = summary;
  renderWindDiagram(beach, peakPeriod, selectedDate);
  const y = speed => pad.top + innerHeight - (speed / chartMax) * innerHeight;

  const yLabels = [0, Math.round(chartMax / 2), chartMax];
  const yGrid = yLabels.map(value => `
    <line x1="${pad.left}" y1="${y(value).toFixed(1)}" x2="${width - pad.right}" y2="${y(value).toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />
    <text x="${pad.left - 10}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end" font-size="${fontSmall}" fill="#64748b">${value}</text>
  `).join('');

  const bars = periods.map((period, index) => {
    const x = layout.getBarCenterForTime(period.startTime) - barWidth / 2;
    const w = barWidth;
    const top = y(period.speed);
    const barHeight = innerHeight - (top - pad.top);
    const fill = index === maxIndex ? '#3b82f6' : '#60a5fa';
    const arrow = Number.isFinite(period.directionDeg)
      ? renderWindArrow(x + w / 2, top - 14, period.directionDeg)
      : '';
    const peakLabel = index === maxIndex
      ? `<text x="${(x + w / 2).toFixed(1)}" y="${Math.max(14, top - 30).toFixed(1)}" text-anchor="middle" font-size="${fontMedium}" font-weight="600" fill="#1d4ed8">Peak</text>`
      : '';
    const description = `${formatTimeNoSeconds(period.startTime)}, ${period.speed} mph${Number.isFinite(period.directionDeg) ? `, ${Math.round(period.directionDeg)} degrees` : ''}`;

    return `
      <g>
        <title>${description}</title>
        <rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="4" fill="${fill}" />
        ${peakLabel}
        ${arrow}
      </g>
    `;
  }).join('');

  const chartAriaLabel = peakPeriod
    ? `${summary}. Daytime wind for ${beach.displayName} on ${formatLongDate(selectedDate)}. Peak wind ${peakPeriod.speed} mph around ${formatTimeNoSeconds(peakPeriod.startTime)}.`
    : `${summary}. Daytime wind for ${beach.displayName} on ${formatLongDate(selectedDate)}.`;
  const timeLabels = renderChartTimeLabels({ ...layout, pad });
  const nowLine = renderChartNowLine({ ...layout, pad }, selectedDate);

  windChartEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="${chartAriaLabel}">
      ${yGrid}
      ${bars}
      ${nowLine}
      ${timeLabels}
    </svg>
  `;
}

function renderWindDiagram(beach, peakPeriod, selectedDate) {
  const panelSelection = getWindDiagramPanelSelection(beach);
  if (!panelSelection) {
    windDiagramEl.innerHTML = '';
    windDiagramEl.hidden = true;
    return;
  }

  const { panel, marker } = panelSelection;
  windDiagramEl.hidden = false;

  const arrowCx = marker.x + (panel.arrowOffset?.x || 0);
  const arrowCy = marker.y + (panel.arrowOffset?.y || 0);
  const arrow = Number.isFinite(peakPeriod?.directionDeg)
    ? renderWindDiagramArrow(arrowCx, arrowCy, peakPeriod.directionDeg)
    : '';
  const diagramLabel = peakPeriod
    ? `Coastal wind diagram for ${beach.displayName} on ${formatLongDate(selectedDate)}. Beach marker shown with peak wind direction near ${formatTimeNoSeconds(peakPeriod.startTime)}.`
    : `Coastal wind diagram for ${beach.displayName} on ${formatLongDate(selectedDate)}. Beach marker shown without a peak wind arrow.`;

  windDiagramEl.innerHTML = `
    <div class="wind-diagram-north" aria-hidden="true">
      <svg viewBox="0 0 24 24" class="wind-diagram-north-svg">
        <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,0.96)" stroke="#0f172a" stroke-width="1.1" />
        <circle cx="12" cy="12" r="9.1" fill="none" stroke="rgba(15,23,42,0.2)" stroke-width="0.7" />
        <path d="M 12 4.9 L 6.9 17.3 L 12 14.8 L 17.1 17.3 Z" fill="#0f172a" />
        <path d="M 12 7.2 L 9.1 14.4 L 12 13.1 Z" fill="#ffffff" />
        <text x="12" y="22.1" text-anchor="middle" font-size="4.2" font-weight="700" fill="#0f172a">N</text>
      </svg>
    </div>
    <div class="wind-diagram-map" role="img" aria-label="${diagramLabel}" style="background-image:url('${panel.imagePath}')">
      <svg viewBox="0 0 100 100" class="wind-diagram-overlay" aria-hidden="true">
        <defs>
          <filter id="markerGlow" x="-120%" y="-120%" width="340%" height="340%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.8" flood-color="rgba(37, 99, 235, 0.45)" />
          </filter>
          <filter id="arrowGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="rgba(130, 80, 223, 0.24)" />
          </filter>
        </defs>
        <circle cx="${marker.x}" cy="${marker.y}" r="2.3" fill="#3b82f6" stroke="#ffffff" stroke-width="1.2" filter="url(#markerGlow)" />
        <circle cx="${marker.x}" cy="${marker.y}" r="4.2" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="0.9" />
        ${arrow}
      </svg>
    </div>
  `;
}

function getWindDiagramPanelSelection(beach) {
  if (!beach) return null;

  if (beach.id === 'sandy_hook') {
    return {
      panel: WIND_REGION_PANELS.sandy_hook,
      marker: WIND_REGION_PANELS.sandy_hook.marker
    };
  }

  if (beach.id === 'asbury_park' || beach.id === 'belmar') {
    return {
      panel: WIND_REGION_PANELS.monmouth,
      marker: WIND_REGION_PANELS.monmouth.beaches[beach.id]
    };
  }

  if (beach.id === 'cape_may') {
    return {
      panel: WIND_REGION_PANELS.cape_may,
      marker: WIND_REGION_PANELS.cape_may.marker
    };
  }

  if (beach.id === 'bar_harbor') {
    return {
      panel: WIND_REGION_PANELS.bar_harbor,
      marker: WIND_REGION_PANELS.bar_harbor.marker
    };
  }

  return null;
}

function renderWindDiagramArrow(cx, cy, directionDeg) {
  const flowDeg = (directionDeg + 180) % 360;
  const shaftTop = cy - 8;
  const shaftBottom = cy + 8;
  const leftX = cx - 3.6;
  const rightX = cx + 3.6;

  return `
    <g filter="url(#arrowGlow)" transform="rotate(${flowDeg.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})">
      <line x1="${cx.toFixed(1)}" y1="${shaftBottom.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${shaftTop.toFixed(1)}" stroke="#8250df" stroke-width="2.4" stroke-linecap="round" />
      <path d="M ${leftX.toFixed(1)} ${(shaftTop + 4).toFixed(1)} L ${cx.toFixed(1)} ${shaftTop.toFixed(1)} L ${rightX.toFixed(1)} ${(shaftTop + 4).toFixed(1)}" fill="none" stroke="#ffffff" stroke-width="5.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
      <path d="M ${leftX.toFixed(1)} ${(shaftTop + 4).toFixed(1)} L ${cx.toFixed(1)} ${shaftTop.toFixed(1)} L ${rightX.toFixed(1)} ${(shaftTop + 4).toFixed(1)}" fill="none" stroke="#8250df" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </g>
  `;
}

function getWindTrendSummary(periods) {
  if (!periods.length) return 'Wind stays fairly steady today';

  const speeds = periods.map(period => period.speed);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);
  const firstSpeed = speeds[0];
  const lastSpeed = speeds[speeds.length - 1];
  const peakIndex = periods.findIndex(period => period.speed === maxSpeed);
  const range = maxSpeed - minSpeed;

  if (range <= 4) {
    return 'Wind stays fairly steady today';
  }

  const peakPeriod = periods[peakIndex];
  const hasInteriorPeak = peakIndex > 0 && peakIndex < periods.length - 1;
  const leftMin = Math.min(...speeds.slice(0, peakIndex));
  const rightMin = Math.min(...speeds.slice(peakIndex + 1));
  const peakStandsOut = hasInteriorPeak && maxSpeed - Math.max(leftMin, rightMin) >= 3;

  if (peakStandsOut && peakIndex >= Math.ceil(periods.length * 0.66)) {
    return 'Wind builds late morning, then eases';
  }

  if (peakStandsOut) {
    return `Wind peaks around ${formatTimeNoSeconds(peakPeriod.startTime)}`;
  }

  if (lastSpeed - firstSpeed >= 4) {
    return 'Wind builds through the afternoon';
  }

  if (firstSpeed - lastSpeed >= 4) {
    return 'Wind eases through the afternoon';
  }

  return 'Wind stays fairly steady today';
}

function renderWindArrow(cx, cy, directionDeg) {
  const flowDeg = (directionDeg + 180) % 360;
  const shaftTop = cy - 10;
  const shaftBottom = cy + 8;
  const leftX = cx - 5;
  const rightX = cx + 5;

  return `
    <g transform="rotate(${flowDeg.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})">
      <line x1="${cx.toFixed(1)}" y1="${shaftBottom.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${shaftTop.toFixed(1)}" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />
      <path d="M ${leftX.toFixed(1)} ${(shaftTop + 5).toFixed(1)} L ${cx.toFixed(1)} ${shaftTop.toFixed(1)} L ${rightX.toFixed(1)} ${(shaftTop + 5).toFixed(1)}" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    </g>
  `;
}

function getClothingRecommendation(selectedDate, range, strongestWindSpeed, hourlyPeriods = []) {
  // Clothing is treated as an action-oriented Beach Note, not a core condition.
  // Summer beach advice weighs humidity and wind together so warm sticky days
  // do not get over-cooled by a routine sea breeze.
  if (!range) return null;

  const high = range.high.temperature;
  const low = range.low.temperature;

  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;

  const beachMode = isBeachMode(selectedDate);
  const dewPoint = getRepresentativeDaytimeDewPoint(hourlyPeriods, selectedDate);
  const labels = beachMode
    ? ['You’ll be good in a T-shirt', 'You may want a long sleeve', 'Bring a sweatshirt', 'Bring layers if you’re staying late']
    : ['You’ll be fine with a light layer', 'Bring a sweatshirt', 'You’ll want a coat', 'Bundle up out there'];

  let level;

  if (beachMode) {
    if (high >= 78) level = 0;
    else if (high >= 68) level = 1;
    else if (high >= 58) level = 2;
    else level = 3;

    if (Number.isFinite(dewPoint)) {
      if (dewPoint >= 68 && high >= 72) level = 0;
      else if (dewPoint >= 62 && high >= 74) level = Math.min(level, 1);
    }

    if (low < 50) level = 3;
    else if (low < 60) level = Math.max(level, 2);

    if (Number.isFinite(strongestWindSpeed)) {
      const isHumid = Number.isFinite(dewPoint) && dewPoint >= 62;
      if (strongestWindSpeed >= 22 && high < 82 && !isHumid) {
        level += 1;
      } else if (strongestWindSpeed >= 15 && high < 72) {
        level += 1;
      }
    }
  } else {
    if (high >= 65) level = 0;
    else if (high >= 55) level = 1;
    else if (high >= 40) level = 2;
    else level = 3;

    if (low < 32) level = 3;
    else if (low < 40) level = Math.max(level, 2);
    else if (low < 50) level = Math.max(level, 1);

    if (Number.isFinite(strongestWindSpeed) && strongestWindSpeed >= 15) {
      level += 1;
    }
  }

  level = Math.max(0, Math.min(level, labels.length - 1));
  return labels[level];
}

function getRepresentativeDaytimeDewPoint(periods, selectedDate) {
  const values = getForecastPeriodsForDate(periods, selectedDate)
    .filter(period => isDaytimeForecastHour(period.startTime, selectedDate))
    .map(getDewPointFahrenheit)
    .filter(Number.isFinite);

  if (!values.length) return null;
  return Math.max(...values);
}

function clothingNote(selectedDate, range, strongestWindSpeed, hourlyPeriods = []) {
  const clothing = getClothingRecommendation(selectedDate, range, strongestWindSpeed, hourlyPeriods);
  if (!clothing) return null;

  return {
    text: clothing,
    priority: 6
  };
}

function isBeachMode(date) {
  const year = date.getFullYear();
  const memorialDay = getLastWeekdayOfMonth(year, 4, 1);
  const laborDay = getNthWeekdayOfMonth(year, 8, 1, 1);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return target >= memorialDay && target <= laborDay;
}

function getLastWeekdayOfMonth(year, monthIndex, weekday) {
  const date = new Date(year, monthIndex + 1, 0);
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() - 1);
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function getNthWeekdayOfMonth(year, monthIndex, weekday, occurrence) {
  const date = new Date(year, monthIndex, 1);
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() + 1);
  }
  date.setDate(date.getDate() + (occurrence - 1) * 7);
  date.setHours(0, 0, 0, 0);
  return date;
}

function renderFutureDaySummary(rangePeriods, windPeriods, selectedDate, temperatureUnit) {
  const range = findDailyTemperatureRange(rangePeriods, selectedDate);
  const strongestWind = getStrongestDaytimeWind(windPeriods, selectedDate);

  weatherCardTitleEl.textContent = 'Daytime';
  airLabelEl.textContent = 'High';
  windLabelEl.textContent = 'Low';
  weatherFeelsEl.textContent = strongestWind
    ? `Strongest daytime wind: ${strongestWind.period.windDirection} ${strongestWind.period.windSpeed}`
    : '';

  if (!range) {
    airTempEl.textContent = '--';
    windEl.textContent = '--';
    weatherUpdatedEl.textContent = 'No daytime forecast data for selected day.';
    weatherRangeEl.innerHTML = '';
    return;
  }

  airTempEl.textContent = `${range.high.temperature}°${temperatureUnit}`;
  windEl.textContent = `${range.low.temperature}°${temperatureUnit}`;
  weatherUpdatedEl.innerHTML = `
    <div>High at ${formatTimeNoSeconds(range.high.startTime)}</div>
    <div>Low at ${formatTimeNoSeconds(range.low.startTime)}</div>
  `;
  weatherRangeEl.innerHTML = '';
}

async function loadWeather(beach, selectedDate) {
  const { forecastData, gridData } = await fetchWeatherData(beach);
  latestHourlyPeriods = forecastData.properties.periods || [];
  const rangePeriods = getGridTemperaturePeriods(gridData?.properties?.temperature?.values, selectedDate);
  const gridWindPeriods = getGridWindPeriods(gridData?.properties?.windSpeed?.values, selectedDate);
  const gridDirectionPeriods = getGridWindDirectionPeriods(gridData?.properties?.windDirection?.values, selectedDate);
  const temperatureChartPeriods = getTemperatureChartPeriods(rangePeriods, latestHourlyPeriods, selectedDate);
  const precipitationChartPeriods = getPrecipitationChartPeriods(latestHourlyPeriods, selectedDate);
  const strongestWindSpeed = getStrongestDaytimeWindSpeed(gridWindPeriods, latestHourlyPeriods, selectedDate);
  latestRangePeriods = rangePeriods;
  latestStrongestDaytimeWindSpeed = strongestWindSpeed;
  renderWindChart(
    getWindChartPeriods(gridWindPeriods, gridDirectionPeriods, latestHourlyPeriods, selectedDate),
    beach,
    selectedDate
  );
  renderTemperatureChart(temperatureChartPeriods, beach, selectedDate);
  renderPrecipitationChart(precipitationChartPeriods, beach, selectedDate);
  const summary = getSummaryPeriod(latestHourlyPeriods, selectedDate);
  if (!summary) {
    weatherCardTitleEl.textContent = isSameLocalDay(selectedDate, getAppNow()) ? 'Now' : 'Daytime';
    airLabelEl.textContent = isSameLocalDay(selectedDate, getAppNow()) ? 'Air' : 'High';
    windLabelEl.textContent = isSameLocalDay(selectedDate, getAppNow()) ? 'Wind' : 'Low';
    airTempEl.textContent = '--';
    windEl.textContent = '--';
    weatherFeelsEl.textContent = '';
    weatherRangeEl.innerHTML = '';
    weatherUpdatedEl.textContent = 'No forecast data for selected day.';
    return;
  }

  if (!isSameLocalDay(selectedDate, getAppNow())) {
    renderFutureDaySummary(
      rangePeriods.length ? rangePeriods : latestHourlyPeriods,
      latestHourlyPeriods,
      selectedDate,
      summary.temperatureUnit
    );
    return;
  }

  weatherCardTitleEl.textContent = 'Now';
  airLabelEl.textContent = 'Air';
  windLabelEl.textContent = 'Wind';
  airTempEl.textContent = `${summary.temperature}°${summary.temperatureUnit}`;
  windEl.textContent = `${summary.windDirection} ${summary.windSpeed}`;
  renderWeatherFeels(summary);
  weatherUpdatedEl.textContent = `Forecast starts ${formatDateTime(summary.startTime)}`;
  renderWeatherRange(
    rangePeriods.length ? rangePeriods : latestHourlyPeriods,
    selectedDate,
    summary.temperatureUnit
  );
}

function normalizeWeatherFixturePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Weather fixture payload is invalid');
  }

  if (Array.isArray(payload?.properties?.periods)) {
    return {
      forecastData: payload,
      gridData: null
    };
  }

  const forecastData = payload.forecastHourly || payload.forecastData || payload.forecast || null;
  const gridData = payload.gridData || payload.forecastGridData || payload.grid || null;

  if (!Array.isArray(forecastData?.properties?.periods)) {
    throw new Error('Weather fixture is missing forecast periods');
  }

  return { forecastData, gridData };
}

async function fetchWeatherData(beach) {
  const fixtureName = getFixtureParam('weather');
  if (TEST_MODE && fixtureName) {
    try {
      return normalizeWeatherFixturePayload(await loadFixtureJson('weather', fixtureName));
    } catch (error) {
      console.error('Weather fixture load failed', error);
      addTestModeError(`Weather fixture failed: ${fixtureName}`);
      throw error;
    }
  }

  const pointsRes = await fetch(`https://api.weather.gov/points/${beach.lat},${beach.lon}`, {
    headers: { Accept: 'application/geo+json' }
  });
  if (!pointsRes.ok) throw new Error('Weather points failed');
  const pointsData = await pointsRes.json();

  const [forecastRes, gridRes] = await Promise.all([
    fetch(pointsData.properties.forecastHourly, {
      headers: { Accept: 'application/geo+json' }
    }),
    fetch(pointsData.properties.forecastGridData, {
      headers: { Accept: 'application/geo+json' }
    })
  ]);
  if (!forecastRes.ok) throw new Error('Hourly forecast failed');

  const [forecastData, gridData] = await Promise.all([
    forecastRes.json(),
    gridRes.ok ? gridRes.json() : Promise.resolve(null)
  ]);

  return { forecastData, gridData };
}

function renderWeatherFeels(period) {
  const comfort = getBeachComfortLabel(period);
  weatherFeelsEl.textContent = comfort ? `Feels: ${comfort}` : '';
}

function getBeachComfortLabel(period) {
  const temperature = period?.temperature;
  const windSpeed = parseWindSpeed(period?.windSpeed);
  const dewPoint = getDewPointFahrenheit(period);

  if (!Number.isFinite(temperature)) {
    return null;
  }

  const labels = [
    'Brutal cold',
    'Bitter cold',
    'Very cold',
    'Cold',
    'Cool',
    'Comfortable',
    'Warm',
    'Hot',
    'Oppressive'
  ];
  let level = getBaseComfortLevel(temperature);

  if (Number.isFinite(windSpeed)) {
    if (temperature < 25 && windSpeed >= 20) {
      level -= 2;
    } else if (temperature < 40 && windSpeed >= 15) {
      level -= 1;
    } else if (temperature >= 40 && temperature <= 60 && windSpeed >= 12) {
      level -= 1;
    } else if (temperature >= 75 && windSpeed >= 12) {
      level -= 1;
    }
  }

  level = Math.max(0, Math.min(level, labels.length - 1));
  const label = labels[level];

  if (temperature < 75 || !Number.isFinite(dewPoint)) {
    return label;
  }

  const descriptor = getDewPointDescriptor(dewPoint);
  if (!descriptor) return label;
  if (label === 'Oppressive' && descriptor === 'oppressive') return 'Oppressive';

  return `${label} (${descriptor})`;
}

function getBaseComfortLevel(temperature) {
  if (temperature < 10) return 0;
  if (temperature <= 24) return 1;
  if (temperature <= 39) return 2;
  if (temperature <= 54) return 3;
  if (temperature <= 64) return 4;
  if (temperature <= 74) return 5;
  if (temperature <= 81) return 6;
  if (temperature <= 87) return 7;
  return 8;
}

function parseWindSpeed(value) {
  if (!value) return null;

  const matches = String(value).match(/\d+/g);
  if (!matches?.length) return null;

  const speeds = matches.map(Number).filter(Number.isFinite);
  if (!speeds.length) return null;

  return Math.max(...speeds);
}

function getDewPointFahrenheit(period) {
  const dewPoint = period?.dewpoint;

  if (Number.isFinite(dewPoint)) {
    return dewPoint;
  }

  if (!dewPoint || !Number.isFinite(dewPoint.value)) {
    return null;
  }

  const unitCode = String(dewPoint.unitCode || '').toLowerCase();
  if (unitCode.includes('degc') || unitCode.endsWith(':c')) {
    return (dewPoint.value * 9) / 5 + 32;
  }

  return dewPoint.value;
}

function getDewPointDescriptor(dewPoint) {
  if (!Number.isFinite(dewPoint)) return null;
  if (dewPoint < 55) return 'dry';
  if (dewPoint <= 60) return 'slightly humid';
  if (dewPoint <= 65) return 'muggy';
  if (dewPoint <= 70) return 'very muggy';
  return 'oppressive';
}

function sealNote(beach, currentPeriod, precipitation, date = getAppNow()) {
  if (beach?.id !== 'sandy_hook') return null;
  if (!isSealSeason(date)) return null;

  const windDirection = String(currentPeriod?.windDirection || '').toUpperCase();
  const windSpeed = parseWindSpeed(currentPeriod?.windSpeed);
  const severePrecip = precipitation?.severity === 'Thunderstorms' || precipitation?.severity === 'Heavy rain';
  const nwFamily = ['NW', 'NNW', 'WNW'];

  const roughWind = Number.isFinite(windSpeed) && (
    (nwFamily.includes(windDirection) && windSpeed > 10)
    || windSpeed >= 15
  );

  if (!roughWind && !severePrecip) return null;

  return {
    text: 'Seals unlikely: wind/rough seas',
    priority: 5
  };
}

function fullMoonRiseNote(astronomy) {
  if (!astronomy) return null;
  if (getMoonPhaseName(astronomy.date) !== 'Full Moon') return null;
  if (!(astronomy.moonrise instanceof Date)) return null;
  if (!(astronomy.sunset instanceof Date)) return null;
  if (astronomy.moonrise <= astronomy.sunset) return null;

  return {
    text: 'Full moon rising after sunset',
    priority: 7
  };
}

function calculateAstronomy(beach, date = getAppNow()) {
  // Sun/moon times are calculated locally from beach coordinates so this
  // feature does not depend on another external API at runtime.
  const observer = new Astronomy.Observer(beach.lat, beach.lon, 0);
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);

  return {
    date: dayStart,
    sunrise: findRiseSet(Astronomy.Body.Sun, observer, dayStart, nextDay, 1),
    sunset: findRiseSet(Astronomy.Body.Sun, observer, dayStart, nextDay, -1),
    moonrise: findRiseSet(Astronomy.Body.Moon, observer, dayStart, nextDay, 1),
    moonset: findRiseSet(Astronomy.Body.Moon, observer, dayStart, nextDay, -1)
  };
}

function findRiseSet(body, observer, dayStart, nextDay, direction) {
  try {
    const event = Astronomy.SearchRiseSet(body, observer, direction, dayStart, 1);
    const eventDate = event?.date instanceof Date ? event.date : null;
    if (!eventDate) return null;
    if (eventDate < dayStart || eventDate >= nextDay) return null;
    return eventDate;
  } catch (error) {
    console.error('Astronomy calculation failed', error);
    return null;
  }
}

function renderAstronomy(astronomy) {
  sunriseTimeEl.textContent = formatEventTime(astronomy?.sunrise);
  sunsetTimeEl.textContent = formatEventTime(astronomy?.sunset);
  moonriseTimeEl.textContent = formatEventTime(astronomy?.moonrise);
  moonsetTimeEl.textContent = formatEventTime(astronomy?.moonset);
}

function formatEventTime(value) {
  return value instanceof Date ? formatTimeNoSeconds(value) : '—';
}

function isSealSeason(date = getAppNow()) {
  const month = date.getMonth();
  const day = date.getDate();

  if ([0, 1, 2, 3, 11].includes(month)) return true;
  return month === 10 && day >= 20;
}

function renderWeatherRange(periods, selectedDate, temperatureUnit) {
  const range = findDailyTemperatureRange(periods, selectedDate);
  if (!range) {
    weatherRangeEl.innerHTML = '';
    return;
  }

  weatherRangeEl.innerHTML = `
    <div>Daytime High ${range.high.temperature}°${temperatureUnit} at ${formatHourLabel(range.high.startTime)}</div>
    <div>Daytime Low ${range.low.temperature}°${temperatureUnit} at ${formatHourLabel(range.low.startTime)}</div>
  `;
}

function findDailyTemperatureRange(periods, selectedDate) {
  const candidates = getRangeCandidates(periods, selectedDate);
  if (!candidates.length) return null;

  let high = candidates[0];
  let low = candidates[0];

  for (const period of candidates.slice(1)) {
    if (period.temperature > high.temperature) high = period;
    if (period.temperature < low.temperature) low = period;
  }

  return { high, low };
}

function getRangeCandidates(periods, selectedDate) {
  // Daytime range is always defined as 6 AM to 6 PM for the selected date.
  const dayPeriods = getForecastPeriodsForDate(periods, selectedDate).filter(period =>
    Number.isFinite(period?.temperature) && !Number.isNaN(new Date(period.startTime).getTime())
  );
  if (!dayPeriods.length) return [];

  const daytimePeriods = dayPeriods.filter(period => isDaytimeForecastHour(period.startTime, selectedDate));
  return daytimePeriods.length ? daytimePeriods : dayPeriods;
}

function isSameLocalDay(value, compareDate) {
  const date = new Date(value);
  return date.getFullYear() === compareDate.getFullYear()
    && date.getMonth() === compareDate.getMonth()
    && date.getDate() === compareDate.getDate();
}

function isDaytimeForecastHour(value, compareDate) {
  if (!isSameLocalDay(value, compareDate)) return false;

  const date = new Date(value);
  const hour = date.getHours();
  return hour >= 6 && hour < 18;
}

function formatHourLabel(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric' });
}

async function loadAlerts(beach) {
  const fixtureName = getFixtureParam('alerts');

  try {
    const data = TEST_MODE && fixtureName
      ? await loadFixtureJson('alerts', fixtureName)
      : await fetch(`https://api.weather.gov/alerts/active?point=${beach.lat},${beach.lon}`).then(async res => {
        if (!res.ok) throw new Error('Alerts fetch failed');
        return res.json();
      });

    latestAlerts = Array.isArray(data) ? data : (data.features || []);
  } catch (err) {
    if (TEST_MODE && fixtureName) {
      console.error('Alerts fixture load failed', err);
      addTestModeError(`Alerts fixture failed: ${fixtureName}`);
      throw err;
    }

    console.error("Alerts fetch failed", err);
    latestAlerts = [];
  }
}

function renderRadar(beach) {
  if (!radarImageEl || !radarStatusEl) return;

  const token = ++radarAnimationToken;
  resetRadarAnimation();
  if (radarMapEl) radarMapEl.innerHTML = buildRadarMapTiles(beach);
  radarImageEl.hidden = true;
  if (radarMarkerEl) radarMarkerEl.hidden = true;
  radarStatusEl.hidden = false;
  radarStatusEl.textContent = 'Radar unavailable.';
  if (radarUpdatedEl) radarUpdatedEl.textContent = '';
  if (radarControlsEl) radarControlsEl.hidden = true;
  if (radarTimeEl) radarTimeEl.textContent = '';

  radarImageEl.onload = () => {
    radarImageEl.hidden = false;
    if (radarMarkerEl) radarMarkerEl.hidden = false;
    radarStatusEl.hidden = true;
    if (radarUpdatedEl) radarUpdatedEl.textContent = `NOAA/NWS radar centered on ${beach.displayName}`;
  };

  radarImageEl.onerror = () => {
    radarImageEl.hidden = true;
    if (radarMarkerEl) radarMarkerEl.hidden = true;
    radarStatusEl.hidden = false;
    radarStatusEl.textContent = 'Radar unavailable.';
    if (radarUpdatedEl) radarUpdatedEl.textContent = '';
  };

  radarImageEl.src = buildRadarImageUrl(beach);
  loadRadarAnimation(beach, token);
}

async function loadRadarAnimation(beach, token) {
  try {
    const frameTimes = await fetchRadarFrameTimes();
    if (token !== radarAnimationToken) return;

    const recentTimes = frameTimes.slice(-8);
    const frames = await preloadRadarFrames(recentTimes.map(time => ({
      time,
      url: buildRadarImageUrl(beach, time)
    })));
    if (token !== radarAnimationToken || frames.length < 2) return;

    radarFrameData = frames;
    radarFrameIndex = 0;
    radarIsPaused = false;
    if (radarControlsEl) radarControlsEl.hidden = false;
    if (radarToggleEl) radarToggleEl.textContent = 'Pause';
    showRadarFrame(0);
    startRadarAnimation();
  } catch (error) {
    console.warn('Radar animation unavailable', error);
  }
}

async function fetchRadarFrameTimes() {
  const url = 'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?service=wms&version=1.3.0&request=GetCapabilities';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Radar capabilities failed');
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const timeDimension = [...doc.getElementsByTagName('Dimension')]
    .find(dimension => dimension.getAttribute('name') === 'time');
  const times = (timeDimension?.textContent || '')
    .split(',')
    .map(value => value.trim())
    .filter(value => !Number.isNaN(new Date(value).getTime()));

  if (times.length < 2) throw new Error('Radar frame times unavailable');
  return times;
}

async function preloadRadarFrames(frames) {
  const results = await Promise.allSettled(frames.map(frame => preloadImage(frame)));
  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);
}

function preloadImage(frame) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(frame);
    image.onerror = () => reject(new Error('Radar frame failed'));
    image.src = frame.url;
  });
}

function startRadarAnimation() {
  stopRadarAnimation();
  if (radarIsPaused || radarFrameData.length < 2) return;

  radarAnimationTimer = window.setInterval(() => {
    showRadarFrame((radarFrameIndex + 1) % radarFrameData.length);
  }, 700);
}

function stopRadarAnimation() {
  if (radarAnimationTimer) {
    window.clearInterval(radarAnimationTimer);
    radarAnimationTimer = null;
  }
}

function resetRadarAnimation() {
  stopRadarAnimation();
  radarFrameData = [];
  radarFrameIndex = 0;
  radarIsPaused = false;
}

function showRadarFrame(index) {
  if (!radarFrameData.length) return;

  radarFrameIndex = index;
  const frame = radarFrameData[radarFrameIndex];
  radarImageEl.src = frame.url;
  if (radarTimeEl) radarTimeEl.textContent = formatRadarFrameTime(frame.time);
}

function toggleRadarAnimation() {
  if (radarFrameData.length < 2) return;

  radarIsPaused = !radarIsPaused;
  if (radarToggleEl) radarToggleEl.textContent = radarIsPaused ? 'Loop' : 'Pause';

  if (radarIsPaused) {
    stopRadarAnimation();
  } else {
    startRadarAnimation();
  }
}

function formatRadarFrameTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function buildRadarImageUrl(beach, time = null) {
  const viewport = getRadarViewport(beach);
  const bbox = [
    viewport.minX,
    viewport.minY,
    viewport.maxX,
    viewport.maxY
  ].map(value => value.toFixed(2)).join(',');
  const cacheBucket = Math.floor(getAppNow().getTime() / (5 * 60 * 1000));
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: 'conus_bref_qcd',
    styles: 'radar_reflectivity',
    crs: 'EPSG:3857',
    bbox,
    width: '800',
    height: '450',
    format: 'image/png',
    transparent: 'true',
    cache: String(cacheBucket)
  });
  if (time) params.set('time', time);

  return `https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?${params}`;
}

function buildRadarMapTiles(beach) {
  const viewport = getRadarViewport(beach);
  const tileSize = viewport.tileSize;
  const minTileX = Math.floor(viewport.pixelMinX / tileSize);
  const maxTileX = Math.floor((viewport.pixelMinX + viewport.width - 1) / tileSize);
  const minTileY = Math.floor(viewport.pixelMinY / tileSize);
  const maxTileY = Math.floor((viewport.pixelMinY + viewport.height - 1) / tileSize);
  const maxTile = (2 ** viewport.zoom) - 1;
  const tiles = [];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      if (y < 0 || y > maxTile) continue;
      const wrappedX = ((x % (maxTile + 1)) + (maxTile + 1)) % (maxTile + 1);
      const left = Math.round((x * tileSize) - viewport.pixelMinX);
      const top = Math.round((y * tileSize) - viewport.pixelMinY);
      const style = [
        `left:${((left / viewport.width) * 100).toFixed(3)}%`,
        `top:${((top / viewport.height) * 100).toFixed(3)}%`,
        `width:${((tileSize / viewport.width) * 100).toFixed(3)}%`,
        `height:${((tileSize / viewport.height) * 100).toFixed(3)}%`
      ].join(';');
      tiles.push(`<img class="radar-map-tile" alt="" src="https://tile.openstreetmap.org/${viewport.zoom}/${wrappedX}/${y}.png" style="${style}" loading="lazy" />`);
    }
  }

  return tiles.join('');
}

function getRadarViewport(beach) {
  const zoom = 9;
  const width = 800;
  const height = 450;
  const tileSize = 256;
  const centerPixel = lonLatToWorldPixel(beach.lon, beach.lat, zoom, tileSize);
  const pixelMinX = centerPixel.x - (width / 2);
  const pixelMinY = centerPixel.y - (height / 2);
  const minMeters = worldPixelToWebMercator(pixelMinX, pixelMinY + height, zoom, tileSize);
  const maxMeters = worldPixelToWebMercator(pixelMinX + width, pixelMinY, zoom, tileSize);

  return {
    zoom,
    width,
    height,
    tileSize,
    pixelMinX,
    pixelMinY,
    minX: minMeters.x,
    minY: minMeters.y,
    maxX: maxMeters.x,
    maxY: maxMeters.y
  };
}

function lonLatToWorldPixel(lon, lat, zoom, tileSize) {
  const sinLat = Math.sin((Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180);
  const scale = tileSize * (2 ** zoom);

  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - (Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI))) * scale
  };
}

function worldPixelToWebMercator(pixelX, pixelY, zoom, tileSize) {
  const scale = tileSize * (2 ** zoom);
  const lon = (pixelX / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * pixelY) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  const earthRadius = 6378137;
  const x = earthRadius * lon * Math.PI / 180;
  const y = earthRadius * Math.log(Math.tan((Math.PI / 4) + ((lat * Math.PI / 180) / 2)));

  return { x, y };
}


function getMoonPhaseName(date = getAppNow()) {
  const synodicMonth = 29.53058867;
  const knownNewMoon = new Date('2000-01-06T18:14:00Z');

  const days = (date - knownNewMoon) / 86400000;
  const age = days % synodicMonth;

  if (age < 1.84566) return 'New Moon';
  if (age < 5.53699) return 'Waxing Crescent';
  if (age < 9.22831) return 'First Quarter';
  if (age < 12.91963) return 'Waxing Gibbous';
  if (age < 16.61096) return 'Full Moon';
  if (age < 20.30228) return 'Waning Gibbous';
  if (age < 23.99361) return 'Last Quarter';
  if (age < 27.68493) return 'Waning Crescent';

  return 'New Moon';
}

function getMoonPhase(date = getAppNow()) {
  const phase = getMoonPhaseName(date);
  const icons = {
    'New Moon': '🌑',
    'Waxing Crescent': '🌒',
    'First Quarter': '🌓',
    'Waxing Gibbous': '🌔',
    'Full Moon': '🌕',
    'Waning Gibbous': '🌖',
    'Last Quarter': '🌗',
    'Waning Crescent': '🌘'
  };

  return `${icons[phase]} ${phase}`;
}

async function loadTides(beach, selectedDate) {
  // Tides use the selected calendar day, not the daytime window.
  // This keeps the tide list, graph, and first/next tide internally consistent.
  const beginDate = formatYmd(selectedDate);
  const endDate = formatYmd(selectedDate);

  const hiloUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=beach-app&begin_date=${beginDate}&end_date=${endDate}&datum=MLLW&station=${beach.tideStationId}&time_zone=lst_ldt&interval=hilo&units=english&format=json`;
  const curveStation = usesReferenceCurve(beach) ? '8531680' : beach.tideStationId;
  const curveUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=beach-app&begin_date=${beginDate}&end_date=${endDate}&datum=MLLW&station=${curveStation}&time_zone=lst_ldt&interval=6&units=english&format=json`;

  const [hiloRes, curveRes] = await Promise.all([fetch(hiloUrl), fetch(curveUrl)]);
  if (!hiloRes.ok) throw new Error('Tides failed');

  const hiloData = await hiloRes.json();
  const predictions = hiloData.predictions || [];
  const curveData = curveRes.ok ? await curveRes.json() : {};
  let curvePoints = curveData.predictions || [];

  tideListEl.innerHTML = '';
  if (!predictions.length) {
    nextTideEl.textContent = 'No tide data available.';
    renderTideChart([], beach, selectedDate);
    return;
  }

  const now = getAppNow();
  const isToday = isSameLocalDay(selectedDate, now);
  const next = isToday
    ? predictions.find(p => new Date(p.t) > now) || predictions[predictions.length - 1]
    : predictions[0];
  nextTideEl.textContent = `${isToday ? 'Next tide' : 'First tide'}: ${tideLabel(next.type)} at ${formatLocalTime(next.t)}`;

  predictions.forEach(prediction => {
    const item = document.createElement('div');
    item.className = 'tide-item';
    item.innerHTML = `
      <span class="tide-type ${prediction.type === 'H' ? 'high' : 'low'}">${tideLabel(prediction.type)}</span>
      <span>${formatLocalTime(prediction.t)}${prediction.v ? ` · ${prediction.v} ft` : ''}</span>
    `;
    tideListEl.appendChild(item);
  });

  if (usesReferenceCurve(beach) && curvePoints.length) {
    curvePoints = transformReferenceCurveForBelmar(curvePoints);
  }

  if (!curvePoints.length) {
    curvePoints = buildCurveFromHiLo(predictions);
  }

  renderTideChart(curvePoints, beach, selectedDate);
}

function buildCurveFromHiLo(predictions) {
  return predictions
    .map(p => ({
      t: p.t,
      v: p.v
    }))
    .filter(p => !Number.isNaN(new Date(p.t).getTime()) && Number.isFinite(Number.parseFloat(p.v)));
}

function usesReferenceCurve(beach) {
  return beach?.id === 'belmar' || beach?.id === 'asbury_park';
}

function transformReferenceCurveForBelmar(points) {
  const minutesShift = 35;
  const heightScale = 0.95;
  const msShift = minutesShift * 60 * 1000;

  return points
    .map(p => {
      const t = new Date(p.t);
      const v = Number.parseFloat(p.v);
      if (Number.isNaN(t.getTime()) || !Number.isFinite(v)) return null;
      return {
        t: new Date(t.getTime() - msShift),
        v: Number((v * heightScale).toFixed(2))
      };
    })
    .filter(Boolean);
}

function ripCurrentNote(alerts) {
  if (!alerts || alerts.length === 0) return null;

  for (const a of alerts) {
    const event = (a.properties.event || "").toLowerCase();
    const desc = (a.properties.description || "").toLowerCase();

    if (event.includes("rip") || event.includes("beach hazards")) {

      if (desc.includes("high")) {
        return { text: 'Rip risk: High', priority: 2 };
      }
      if (desc.includes("moderate")) {
        return { text: 'Rip risk: Moderate', priority: 2 };
      }

      return { text: 'Rip risk: Moderate', priority: 2 };
    }
  }

  return null;
}

function waterQualityNote(waterQuality, isToday) {
  if (!isToday || !waterQuality) return null;

  return (waterQuality.locations || [])
    .map(location => {
      const activeIncident = location.activeIncident;
      const noteLabel = activeIncident?.locationLabel || location.noteLabel || location.label;
      if (activeIncident?.type === 'CLOSURE') {
        return {
          text: `${noteLabel}: Closed`,
          priority: 0
        };
      }

      if (activeIncident?.type === 'ADVISORY') {
        return {
          text: `${noteLabel}: Advisory`,
          priority: 1
        };
      }

      if (activeIncident?.type === 'RESAMPLING') {
        return {
          text: `${noteLabel}: Resampling underway`,
          priority: 2
        };
      }

      if (activeIncident?.type === 'RAINFALL') {
        return {
          text: `${noteLabel}: Rainfall advisory`,
          priority: 2
        };
      }

      if (location.latestElevatedSample) {
        return {
          text: `${location.latestElevatedSample.beachName || location.label}: Elevated bacteria`,
          priority: 2
        };
      }

      return null;
    })
    .filter(Boolean);
}

async function loadWaterQuality(beach, selectedDate = getAppNow()) {
  if (!beach.waterQualitySource) {
    latestWaterQuality = null;
    renderWaterQualityUnavailable('Water quality data is not configured for this beach.');
    return;
  }

  if (beach.waterQualitySource.provider === 'njdep') {
    await loadNjdepWaterQuality(beach, selectedDate);
    return;
  }

  if (beach.waterQualitySource.provider === 'dnrec') {
    await loadDnrecWaterQuality(beach);
    return;
  }

  if (beach.waterQualitySource.provider === 'mhb') {
    await loadMhbWaterQuality(beach);
    return;
  }

  latestWaterQuality = null;
  renderWaterQualityUnavailable('Water quality data is not available for this beach.');
}

async function loadNjdepWaterQuality(beach, selectedDate = getAppNow()) {
  try {
    const source = beach.waterQualitySource;
    const waterStartDate = addDays(selectedDate, -45);
    const incidentStartDate = addDays(selectedDate, -60);
    const endDate = selectedDate;

    const municipalityIds = getNjdepMunicipalityIds(source);
    const responses = await Promise.all(municipalityIds.map(async municipalityId => {
      const scopedSource = { ...source, municipalityId };
      const [waterRes, incidentRes, countsRes] = await Promise.all([
        fetch(buildNjdepWaterQualityUrl(scopedSource, waterStartDate, endDate)),
        fetch(buildNjdepIncidentUrl(scopedSource, incidentStartDate, endDate)),
        fetch(buildNjdepCountsUrl(scopedSource, incidentStartDate, endDate))
      ]);

      if (!waterRes.ok) {
        throw new Error(`NJDEP water quality failed (${waterRes.status || 'no status'})`);
      }

      return {
        waterCsv: await waterRes.text(),
        incidentCsv: incidentRes.ok ? await incidentRes.text() : '',
        countsData: countsRes.ok ? await countsRes.json() : null
      };
    }));

    const sampleRows = filterNearbyNjdepRows(responses.flatMap(response => parseCsv(response.waterCsv)), beach, source);
    const incidentRows = filterNearbyNjdepRows(responses.flatMap(response => parseCsv(response.incidentCsv)), beach, source);
    const samples = sampleRows.map(normalizeNjdepSample).filter(Boolean);
    const incidents = incidentRows.map(normalizeNjdepIncident).filter(Boolean);
    const locations = buildNjdepWaterQualityLocations(source, samples, incidents, selectedDate);
    const counts = aggregateNjdepCounts(responses.map(response => response.countsData?.payload).filter(Boolean));

    latestWaterQuality = {
      locations,
      counts,
      sourceLabel: 'NJDEP CCMP'
    };

    renderWaterQualityCard(beach, latestWaterQuality);
  } catch (error) {
    console.warn('NJDEP water quality failed', error);
    latestWaterQuality = null;
    renderWaterQualityUnavailable(`NJDEP water quality unavailable${error?.message ? `: ${error.message}` : ''}.`);
  }
}

async function loadDnrecWaterQuality(beach) {
  try {
    const source = beach.waterQualitySource;
    const unitIds = getDnrecUnitIds(source);
    const [layerRes, detailResponses] = await Promise.all([
      fetch(buildDnrecLayerUrl(unitIds)),
      Promise.all(unitIds.map(async unitId => {
        try {
          const res = await fetch(buildDnrecDetailUrl(unitId));
          return {
            unitId,
            html: res.ok ? await res.text() : ''
          };
        } catch {
          return {
            unitId,
            html: ''
          };
        }
      }))
    ]);

    if (!layerRes.ok) {
      throw new Error(`DNREC map layer failed (${layerRes.status || 'no status'})`);
    }

    const layerData = await layerRes.json();
    const units = (layerData.features || []).map(normalizeDnrecUnit).filter(Boolean);
    const detailsByUnitId = detailResponses.reduce((details, response) => {
      details.set(String(response.unitId), response.html ? parseDnrecDetailPage(response.html) : null);
      return details;
    }, new Map());
    const unavailableDetailCount = detailResponses.filter(response => !response.html).length;

    latestWaterQuality = {
      locations: buildDnrecWaterQualityLocations(source, units, detailsByUnitId),
      detailNote: unavailableDetailCount
        ? 'DNREC detail pages block browser reads, so sample tables may be unavailable here.'
        : '',
      sourceLabel: 'DNREC Recreational Waters'
    };

    renderWaterQualityCard(beach, latestWaterQuality);
  } catch (error) {
    console.warn('DNREC water quality failed', error);
    latestWaterQuality = null;
    renderWaterQualityUnavailable(`DNREC water quality unavailable${error?.message ? `: ${error.message}` : ''}.`);
  }
}

async function loadMhbWaterQuality(beach) {
  try {
    const source = beach.waterQualitySource;
    const res = await fetch(buildMhbProxyUrl(source, beach.id));
    if (!res.ok) {
      throw new Error(`Maine Healthy Beaches proxy failed (${res.status || 'no status'})`);
    }

    latestWaterQuality = await res.json();
    renderWaterQualityCard(beach, latestWaterQuality);
  } catch (error) {
    console.warn('Maine Healthy Beaches water quality failed', error);
    latestWaterQuality = null;
    renderWaterQualityUnavailable(`Maine Healthy Beaches water quality unavailable${error?.message ? `: ${error.message}` : ''}.`);
  }
}

function buildNjdepWaterQualityUrl(source, startDate, endDate) {
  return buildNjdepPublicDataUrl('data/download/waterQuality', source, startDate, endDate, {
    downloadType: 'water-quality'
  });
}

function buildNjdepIncidentUrl(source, startDate, endDate) {
  return buildNjdepPublicDataUrl('data/download/incident/', source, startDate, endDate, {
    downloadType: 'incident'
  });
}

function buildNjdepCountsUrl(source, startDate, endDate) {
  return buildNjdepPublicDataUrl('data/counts', source, startDate, endDate);
}

function buildNjdepPublicDataUrl(path, source, startDate, endDate, extra = {}) {
  const params = new URLSearchParams({
    program: '4',
    municipality: String(source.municipalityId),
    startDate: getLocalDateKey(startDate),
    endDate: getLocalDateKey(endDate),
    ...extra
  });
  return `https://beachapi.njdep.rutgers.edu/api/public/${path}?${params.toString()}`;
}

function getNjdepMunicipalityIds(source) {
  if (Array.isArray(source.municipalityIds) && source.municipalityIds.length) {
    return source.municipalityIds;
  }
  return source.municipalityId ? [source.municipalityId] : [];
}

function buildDnrecLayerUrl(unitIds) {
  const where = unitIds.length
    ? `UnitID IN (${unitIds.map(unitId => Number(unitId)).filter(Number.isFinite).join(',')})`
    : '1=1';
  const params = new URLSearchParams({
    where,
    outFields: 'UnitID,UnitName,CurrentAdvisory,UnitDesc,URL,newURL',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json'
  });
  return `https://enterprise.firstmap.delaware.gov/arcgis/rest/services/Environmental/DE_DNREC_Monitoring_Network/MapServer/2/query?${params.toString()}`;
}

function buildDnrecDetailUrl(unitId) {
  return `https://recwaters.dnrec.delaware.gov/BeachInfo.aspx?UnitID=${encodeURIComponent(unitId)}`;
}

function buildMhbProxyUrl(source, beachId) {
  const url = new URL(source.proxyUrl || '/api/water-quality/maine', window.location.origin);
  url.searchParams.set('beach', beachId);
  return url.toString();
}

function getDnrecUnitIds(source) {
  return getUniqueSorted((source.locations || [])
    .flatMap(location => location.unitIds || [])
    .map(unitId => String(unitId)));
}

function buildDnrecWaterQualityLocations(source, units, detailsByUnitId) {
  return (source.locations || []).map(config => {
    const locationUnits = units.filter(unit => (config.unitIds || []).some(unitId => String(unitId) === String(unit.unitId)));
    const samples = locationUnits
      .map(unit => {
        const latestSample = detailsByUnitId.get(String(unit.unitId))?.latestSample;
        return latestSample ? {
          ...latestSample,
          stationName: unit.unitName,
          beachName: unit.unitName,
          locationType: unit.description || 'DNREC'
        } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.date - a.date);
    const activeIncident = getDnrecActiveIncident(locationUnits);
    const latestSample = samples[0] || null;

    return {
      id: config.id,
      label: config.label,
      activeIncident,
      latestSample,
      latestSamples: samples,
      latestElevatedSample: getLatestElevatedDnrecSample(samples),
      sampleCount: samples.length,
      incidentCount: activeIncident ? 1 : 0,
      stationNames: getUniqueSorted(locationUnits.map(unit => unit.unitName).filter(Boolean)),
      beachNames: getUniqueSorted(locationUnits.map(unit => unit.unitName).filter(Boolean)),
      geometricMean: getLatestDnrecMean(locationUnits, detailsByUnitId, 'geometricMean'),
      thirtyDayGeometricMean: getLatestDnrecMean(locationUnits, detailsByUnitId, 'thirtyDayGeometricMean')
    };
  });
}

function normalizeDnrecUnit(feature) {
  const attributes = feature?.attributes || {};
  const unitId = attributes.UnitID;
  if (unitId === undefined || unitId === null) return null;

  return {
    unitId: String(unitId),
    unitName: attributes.UnitName,
    currentAdvisory: Number(attributes.CurrentAdvisory),
    description: attributes.UnitDesc,
    sourceUrl: attributes.URL || buildDnrecDetailUrl(unitId),
    lat: feature?.geometry?.y,
    lon: feature?.geometry?.x
  };
}

function getDnrecActiveIncident(units) {
  const unit = [...units].sort((a, b) => getDnrecStatusRank(b.currentAdvisory) - getDnrecStatusRank(a.currentAdvisory))[0];
  if (!unit || getDnrecStatusRank(unit.currentAdvisory) <= 0) return null;

  return {
    type: unit.currentAdvisory === 0 ? 'ADVISORY' : 'RESAMPLING',
    rawType: getDnrecStatusLabel(unit.currentAdvisory),
    reason: unit.unitName,
    sourceUrl: unit.sourceUrl
  };
}

function getDnrecStatusRank(status) {
  if (status === 0) return 2;
  if (status === 2) return 1;
  return 0;
}

function getDnrecStatusLabel(status) {
  if (status === 0) return 'Current Advisory';
  if (status === 2) return 'Resampling Enterococcus Spike';
  if (status === 3) return 'Winter - Not Currently Sampling';
  if (status === 4) return 'Monitoring - No Current Advisory';
  if (status === 1) return 'Advisories Not Issued';
  return 'Unknown';
}

function parseDnrecDetailPage(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const samples = parseDnrecSampleRows(doc);

  return {
    geometricMean: parseNumericText(doc.getElementById('ContentPlaceHolder1_lblEntro')?.textContent),
    thirtyDayGeometricMean: parseNumericText(doc.getElementById('ContentPlaceHolder1_lblLast30daysEntro')?.textContent),
    latestSample: samples[0] || null,
    samples
  };
}

function parseDnrecSampleRows(doc) {
  return [...doc.querySelectorAll('#ContentPlaceHolder1_gvEntro tbody tr')]
    .map(row => {
      const cells = [...row.querySelectorAll('td')].map(cell => cell.textContent.trim());
      if (cells.length < 2) return null;

      const date = parseNjdepDate(cells[0]);
      const value = parseNumericText(cells[1]);
      if (!date || !Number.isFinite(value)) return null;

      return {
        date,
        dateLabel: cells[0],
        timeLabel: '',
        stationName: '',
        beachName: '',
        locationType: 'DNREC',
        value,
        units: 'CFU/100mL',
        resultType: 'Enterococcus'
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date - a.date);
}

function getLatestElevatedDnrecSample(samples) {
  return samples
    .filter(sample => sample.value > 104)
    .sort((a, b) => b.value - a.value)[0] || null;
}

function getLatestDnrecMean(units, detailsByUnitId, key) {
  return units
    .map(unit => ({
      label: unit.unitName,
      value: detailsByUnitId.get(String(unit.unitId))?.[key]
    }))
    .find(item => Number.isFinite(item.value)) || null;
}

function parseNumericText(value) {
  const number = Number.parseFloat(String(value || '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

function buildNjdepWaterQualityLocations(source, samples, incidents, selectedDate) {
  const configs = source.locations?.length
    ? source.locations
    : [Object.freeze({ id: 'default', label: 'Water Quality', locationTypes: Object.freeze([]) })];

  return configs.map(config => {
    const locationSamples = samples.filter(sample => matchesNjdepLocation(sample, config));
    const locationIncidents = incidents.filter(incident => matchesNjdepLocation(incident, config));
    const latestSamples = getLatestNjdepSamples(locationSamples);
    const activeIncident = getActiveNjdepIncident(locationIncidents, selectedDate);

    return {
      id: config.id,
      label: config.label,
      activeIncident,
      latestSample: latestSamples[0] || null,
      latestSamples,
      latestElevatedSample: getLatestElevatedNjdepSample(latestSamples),
      sampleCount: locationSamples.length,
      incidentCount: locationIncidents.length,
      stationNames: getUniqueSorted(locationSamples.map(sample => sample.stationName).filter(Boolean)),
      beachNames: getUniqueSorted([
        ...locationSamples.map(sample => sample.beachName),
        ...locationIncidents.map(incident => incident.beachName)
      ].filter(Boolean))
    };
  });
}

function matchesNjdepLocation(item, config) {
  const locationTypes = config.locationTypes || [];
  const beachNames = config.beachNames || [];
  const hasTypeMatch = locationTypes.length
    ? locationTypes.some(type => sameNjdepText(type, item.locationType))
    : true;
  const hasNameMatch = beachNames.length
    ? beachNames.some(name => sameNjdepBeachName(name, item.beachName))
    : true;

  return hasTypeMatch && hasNameMatch;
}

function sameNjdepText(a, b) {
  return normalizeNjdepText(a) === normalizeNjdepText(b);
}

function sameNjdepBeachName(expected, actual) {
  const normalizedExpected = normalizeNjdepText(expected);
  const normalizedActual = normalizeNjdepBaseBeachName(actual);
  return normalizedActual === normalizedExpected;
}

function normalizeNjdepBaseBeachName(value) {
  return normalizeNjdepText(value)
    .replace(/\s*[nsew]\d+$/i, '')
    .replace(/\s+(north|south|east|west)\s+\d+$/i, '');
}

function normalizeNjdepText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function aggregateNjdepCounts(payloads) {
  return payloads.reduce((totals, payload) => {
    totals['water-quality'] += Number(payload?.['water-quality']) || 0;
    totals.incident += Number(payload?.incident) || 0;
    return totals;
  }, { 'water-quality': 0, incident: 0 });
}

function getUniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function parseCsv(csvText) {
  if (!csvText || !csvText.trim()) return [];

  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(value);
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some(cell => cell !== '')) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map(header => header.trim());
  return rows.slice(1).map(cells => headers.reduce((record, header, index) => {
    record[header] = cells[index] || '';
    return record;
  }, {}));
}

function filterNearbyNjdepRows(rows, beach, source) {
  const maxDistance = source.maxDistanceMiles || 5;
  return rows
    .map(row => {
      const lat = Number.parseFloat(row.Lat_DD);
      const lon = Number.parseFloat(row.Lon_DD);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        row,
        distanceMiles: getDistanceMiles(beach.lat, beach.lon, lat, lon)
      };
    })
    .filter(item => item && item.distanceMiles <= maxDistance)
    .map(item => item.row);
}

function normalizeNjdepSample(row) {
  const date = parseNjdepDateTime(row.Result_Date, row.Result_Time);
  const value = Number.parseFloat(row.Result_Measure);
  if (!date || !Number.isFinite(value)) return null;

  return {
    date,
    dateLabel: row.Result_Date,
    timeLabel: row.Result_Time,
    stationName: row.Station_Name,
    beachName: row.Beach_Name,
    locationType: row.Location_Type_Name,
    stationType: row.Station_Type_Name,
    value,
    units: row.Units_Name,
    resultType: row.Result_Type_Name,
    remark: row.Remark_Code_Name
  };
}

function normalizeNjdepIncident(row) {
  const startDate = parseNjdepDate(row.Incident_Start_Date);
  const endDate = parseNjdepDate(row.Incident_End_Date);
  if (!startDate) return null;

  return {
    startDate,
    endDate,
    startLabel: row.Incident_Start_Date,
    endLabel: row.Incident_End_Date,
    stationName: row.Station_Name,
    beachName: row.Beach_Name,
    locationType: row.Location_Type_Name,
    type: getNjdepIncidentType(row.Beach_Act_Type_Name),
    rawType: row.Beach_Act_Type_Name,
    reason: row.Beach_Reason_Type_Desc || row.Beach_Reason_Type_Name,
    comments: row.Incident_Additional_Comments
  };
}

function getNjdepIncidentType(value) {
  const normalized = String(value || '').toUpperCase();
  if (normalized.includes('CLOSURE')) return 'CLOSURE';
  if (normalized.includes('ADV')) return 'ADVISORY';
  return normalized || 'INCIDENT';
}

function getLatestNjdepSamples(samples) {
  if (!samples.length) return [];

  const sorted = [...samples].sort((a, b) => b.date - a.date);
  const latestDayKey = getLocalDateKey(sorted[0].date);
  return sorted.filter(sample => getLocalDateKey(sample.date) === latestDayKey);
}

function getLatestElevatedNjdepSample(samples) {
  return samples
    .filter(sample => sample.resultType === 'Enterococcus' && sample.value > 104)
    .sort((a, b) => b.value - a.value)[0] || null;
}

function getActiveNjdepIncident(incidents, selectedDate) {
  const selectedDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const nextDay = addDays(selectedDay, 1);

  return incidents
    .filter(incident => {
      const end = incident.endDate ? addDays(incident.endDate, 1) : nextDay;
      return incident.startDate < nextDay && end > selectedDay;
    })
    .sort((a, b) => {
      const typeRank = { CLOSURE: 2, ADVISORY: 1 };
      return (typeRank[b.type] || 0) - (typeRank[a.type] || 0) || b.startDate - a.startDate;
    })[0] || null;
}

function parseNjdepDate(value) {
  const match = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, month, day, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNjdepDateTime(dateValue, timeValue) {
  const date = parseNjdepDate(dateValue);
  if (!date) return null;

  const timeMatch = String(timeValue || '').match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }

  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function renderWaterQualityLoading(beach) {
  if (!waterQualityCardEl || !waterQualityStatusEl || !waterQualityDetailsEl) return;

  waterQualityCardEl.hidden = false;
  waterQualityDetailsEl.innerHTML = '';
  waterQualityStatusEl.textContent = beach.waterQualitySource
    ? `Checking ${getWaterQualityProviderLabel(beach.waterQualitySource)} water quality data...`
    : 'Water quality data is not configured for this beach.';
}

function renderWaterQualityUnavailable(message) {
  if (!waterQualityCardEl || !waterQualityStatusEl || !waterQualityDetailsEl) return;

  waterQualityCardEl.hidden = false;
  waterQualityStatusEl.textContent = message;
  waterQualityDetailsEl.innerHTML = '';
}

function renderWaterQualityCard(beach, waterQuality) {
  if (!waterQualityCardEl || !waterQualityStatusEl || !waterQualityDetailsEl) return;

  const problemLocations = (waterQuality.locations || []).filter(location =>
    location.activeIncident || location.latestElevatedSample
  );
  const statusText = problemLocations.length
    ? `${problemLocations.length} monitored ${problemLocations.length === 1 ? 'area needs' : 'areas need'} attention`
    : 'All monitored areas look OK.';

  waterQualityStatusEl.textContent = statusText;

  waterQualityDetailsEl.innerHTML = [
    ...(waterQuality.locations || []).map(renderWaterQualitySummaryLocation),
    renderWaterQualitySummaryFooter(waterQuality)
  ].filter(Boolean).join('');
}

function renderWaterQualitySummaryLocation(location) {
  const statusText = getWaterQualityLocationStatusText(location);
  const issueText = getWaterQualityIssueText(location);

  return `
    <section class="water-quality-location ${getWaterQualityStatusClass(location)}">
      <div class="water-quality-row">
        <h3>${escapeHtml(location.label)}</h3>
        <strong>${escapeHtml(statusText)}</strong>
      </div>
      ${issueText ? `<div class="water-quality-issue">${escapeHtml(issueText)}</div>` : ''}
    </section>
  `;
}

function renderWaterQualitySummaryFooter(waterQuality) {
  const latestDate = getLatestWaterQualitySampleDate(waterQuality.locations || []);
  const parts = [
    latestDate ? `Latest sample ${formatShortDate(latestDate)}` : null,
    waterQuality.sourceLabel ? `Source: ${waterQuality.sourceLabel}` : null
  ].filter(Boolean);

  return parts.length ? `<div class="water-quality-footer">${escapeHtml(parts.join(' · '))}</div>` : '';
}

function getWaterQualityIssueText(location) {
  const activeIncident = location.activeIncident;
  if (activeIncident) {
    return activeIncident.reason || activeIncident.rawType || getWaterQualityLocationStatusText(location);
  }

  if (location.latestElevatedSample) {
    return 'Elevated bacteria sample';
  }

  return '';
}

function getWaterQualityStatusClass(location) {
  if (location.activeIncident?.type === 'CLOSURE') return 'is-closed';
  if (location.activeIncident || location.latestElevatedSample) return 'has-issue';
  return 'is-ok';
}

function getLatestWaterQualitySampleDate(locations) {
  return locations
    .map(location => location.latestSample?.date)
    .filter(Boolean)
    .map(value => new Date(value))
    .filter(date => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a)[0] || null;
}

function getWaterQualityLocationStatusText(location) {
  if (location.activeIncident?.type === 'CLOSURE') return 'Closed';
  if (location.activeIncident?.type === 'ADVISORY') return 'Advisory';
  if (location.activeIncident?.type === 'RESAMPLING') return 'Resampling';
  if (location.activeIncident?.type === 'RAINFALL') return 'Rainfall advisory';
  if (location.latestElevatedSample) return 'Elevated';
  return 'OK';
}

function getWaterQualityProviderLabel(source) {
  if (source?.provider === 'mhb') return 'Maine Healthy Beaches';
  if (source?.provider === 'dnrec') return 'DNREC';
  if (source?.provider === 'njdep') return 'NJDEP';
  return 'agency';
}

function renderWaterQualityDetail(label, value) {
  return `
    <div class="water-quality-detail">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderOceanLoading() {
  waterTempEl.textContent = '--';
  waterUpdatedEl.textContent = 'Checking ocean data...';
  renderWaveModelUnavailable('Checking waves...');
}

function renderWaveModelUnavailable(message = '--') {
  if (offshoreWavesEl) offshoreWavesEl.textContent = message;
  if (estimatedBreakersEl) estimatedBreakersEl.textContent = '--';
  if (breakPointEl) breakPointEl.textContent = '--';
  if (waveModelDetailsEl) waveModelDetailsEl.hidden = true;
  if (waveModelDetailTextEl) waveModelDetailTextEl.innerHTML = '';
}

function renderWaveModel(oceanWave) {
  if (!offshoreWavesEl || !estimatedBreakersEl || !breakPointEl) return;

  if (!oceanWave?.offshoreWave) {
    if (oceanWave?.error) {
      offshoreWavesEl.textContent = getWaveModelErrorLabel(oceanWave.error);
      estimatedBreakersEl.textContent = '--';
      breakPointEl.textContent = '--';
      renderWaveModelDetails(oceanWave);
      return;
    }

    renderWaveModelUnavailable('Unavailable');
    return;
  }

  const offshore = oceanWave.offshoreWave;
  offshoreWavesEl.textContent = `${formatFeet(offshore.significantHeightM)} at ${Math.round(offshore.periodS)} sec`;

  const estimate = oceanWave.estimate;
  if (estimate?.status !== WAVE_MODEL_STATUS.OK) {
    estimatedBreakersEl.textContent = 'Unavailable';
    breakPointEl.textContent = '--';
    renderWaveModelDetails(oceanWave);
    return;
  }

  estimatedBreakersEl.textContent = `Approx. ${formatFeet(estimate.breaking.waveHeightM)}`;
  breakPointEl.textContent = `About ${roundToNearest(metersToYards(estimate.breaking.distanceFromCurrentWaterlineM), 5)} yd offshore`;
  renderWaveModelDetails(oceanWave);
}

function renderWaveModelDetails(oceanWave) {
  if (!waveModelDetailsEl || !waveModelDetailTextEl) return;

  const estimate = oceanWave?.estimate;
  const lines = [];

  if (estimate?.status === WAVE_MODEL_STATUS.OK) {
    lines.push(`Estimated breaking depth: ${formatFeet(estimate.breaking.localDepthM)}`);
    lines.push(`Estimated breaking distance: ${roundToNearest(metersToYards(estimate.breaking.distanceFromCurrentWaterlineM), 5)} yd from current waterline`);
    lines.push(`Breaking criterion: ${estimate.breaking.governingCriterion === 'depth' ? 'depth-limited' : 'steepness-limited'}`);
    lines.push(`Submerged profile: 1:${Math.round(1 / estimate.inputs.offshoreSlope)}`);
    lines.push(`Exposed beach face: 1:${Math.round(1 / estimate.inputs.landwardSlope)}`);
    if (estimate.metadata?.approximate) {
      lines.push(`${estimate.metadata.tideSourceDatum} tide used as approximate ${estimate.metadata.modelDatum}`);
    }
  } else if (estimate?.status) {
    lines.push(`Estimated breakers unavailable: ${estimate.status.replaceAll('-', ' ')}`);
  } else if (oceanWave?.error) {
    lines.push(getWaveModelErrorDetail(oceanWave.error));
  }

  lines.push('Estimated from offshore buoy conditions, tide level, and a simplified beach profile. Actual waves vary with sandbars, wind, direction, storms, and local bathymetry.');

  waveModelDetailsEl.hidden = false;
  waveModelDetailTextEl.innerHTML = lines.map(line => `<div>${escapeHtml(line)}</div>`).join('');
}

function getWaveModelErrorLabel(error) {
  const message = error?.message || '';
  if (message.includes('proxy route is not deployed')) return 'Proxy not configured';
  return 'Unavailable';
}

function getWaveModelErrorDetail(error) {
  const message = error?.message || String(error || '');
  if (message.includes('proxy route is not deployed')) {
    return 'NDBC waves need the /api/waves/ndbc proxy route or a wavesProxyUrl test parameter.';
  }
  return `Wave data unavailable: ${message || 'unknown error'}`;
}

async function loadWaterTemp(beach, selectedDate = getAppNow()) {
  renderOceanLoading();

  if (!isSameLocalDay(selectedDate, getAppNow())) {
    waterTempEl.textContent = '--';
    waterUpdatedEl.textContent = 'Water temp is only available for today.';
    renderWaveModelUnavailable('Only today');
    return;
  }

  const [reading, oceanWave] = await Promise.all([
    fetchWaterTempSource(beach.waterTempSource),
    loadWaveModelForBeach(beach).catch(error => {
      console.warn('Wave model failed', error);
      return { error };
    })
  ]);
  waterTempEl.textContent = `${reading.temperature}°F`;
  renderWaveModel(oceanWave);

  const altReading = await fetchAltWaterTempSource(beach.altWaterTempSource);
  waterUpdatedEl.innerHTML = [
    escapeHtml(reading.label),
    oceanWave?.sourceLabel ? `Waves: ${escapeHtml(oceanWave.sourceLabel)}` : null,
    altReading ? `Alt: ${escapeHtml(altReading.label)} ${escapeHtml(altReading.temperature)}°F` : null
  ].filter(Boolean).join('<br>');
}

async function loadWaveModelForBeach(beach) {
  const config = WAVE_MODEL_CONFIG[beach?.waveModelConfigId];
  if (!config?.enabled) {
    return {
      estimate: { status: WAVE_MODEL_STATUS.DISABLED }
    };
  }

  const now = getAppNow();
  const [offshoreWave, tide] = await Promise.all([
    fetchOffshoreWave(config, now),
    fetchWaveModelTide(config, now)
  ]);

  return {
    offshoreWave,
    sourceLabel: `NDBC ${config.buoyStationId}`,
    estimate: estimateNearshoreBreaking({
      locationId: beach.id,
      locationConfig: config,
      offshoreWave,
      tide,
      now
    })
  };
}

async function fetchOffshoreWave(config, now) {
  const fixtureName = getFixtureParam('waves');
  if (TEST_MODE && fixtureName) {
    return normalizeOffshoreWaveFixture(await loadFixtureJson('waves', fixtureName), config);
  }

  const reading = await fetchNdbcWaveObservation(config);

  return {
    significantHeightM: reading.significantHeightM,
    periodS: reading.periodS,
    referenceDepthM: config.offshoreReferenceDepthM,
    observationTime: reading.time,
    sourceFetchTime: now.toISOString()
  };
}

async function fetchNdbcWaveObservation(config) {
  const proxyUrl = buildNdbcWavesProxyUrl(config);
  if (proxyUrl) {
    const res = await fetch(proxyUrl, {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(isDefaultSameOriginApi(config.proxyUrl) ? 'Wave proxy route is not deployed' : 'Wave proxy failed');
    const data = await res.json();
    const reading = data.observation;
    if (!Number.isFinite(reading?.significantHeightM) || !Number.isFinite(reading?.periodS)) {
      throw new Error('No wave data in proxy response');
    }
    return reading;
  }

  const res = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${config.buoyStationId}.txt`);
  if (!res.ok) throw new Error('Wave data failed');
  const reading = parseNdbcWaveObservation(await res.text());
  if (!reading) throw new Error('No wave data in buoy feed');
  return reading;
}

function buildNdbcWavesProxyUrl(config) {
  if (!config.proxyUrl) return null;
  const url = new URL(config.proxyUrl, window.location.origin);
  url.searchParams.set('station', config.buoyStationId);
  return url.toString();
}

function isDefaultSameOriginApi(value) {
  return String(value || '').startsWith('/api/');
}

function normalizeOffshoreWaveFixture(payload, config) {
  return {
    significantHeightM: Number(payload.significantHeightM ?? payload.waveHeightM),
    periodS: Number(payload.periodS ?? payload.wavePeriodS),
    referenceDepthM: Number(payload.referenceDepthM ?? config.offshoreReferenceDepthM),
    observationTime: payload.observationTime || getAppNow().toISOString(),
    sourceFetchTime: payload.sourceFetchTime || getAppNow().toISOString()
  };
}

function parseNdbcWaveObservation(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const headerLine = lines.find(line => line.startsWith('#YY') || line.startsWith('#yr'));
  if (!headerLine) return null;

  const columns = headerLine.replace(/^#/, '').trim().split(/\s+/);
  const waveHeightIndex = columns.indexOf('WVHT');
  const dominantPeriodIndex = columns.indexOf('DPD');
  if (waveHeightIndex < 0 || dominantPeriodIndex < 0) return null;

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const values = line.split(/\s+/);
    const significantHeightM = Number.parseFloat(values[waveHeightIndex]);
    const periodS = Number.parseFloat(values[dominantPeriodIndex]);
    if (!Number.isFinite(significantHeightM) || !Number.isFinite(periodS)) continue;

    const year = Number.parseInt(values[0], 10);
    const month = Number.parseInt(values[1], 10);
    const day = Number.parseInt(values[2], 10);
    const hour = Number.parseInt(values[3], 10);
    const minute = Number.parseInt(values[4], 10);

    return {
      significantHeightM,
      periodS,
      time: new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString()
    };
  }

  return null;
}

async function fetchWaveModelTide(config, now) {
  const beginDate = formatYmd(now);
  const endDate = formatYmd(now);
  const curveStation = config.tideStationId === '8532337' ? '8531680' : config.tideStationId;
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=beach-app&begin_date=${beginDate}&end_date=${endDate}&datum=${config.tidePredictionDatum}&station=${curveStation}&time_zone=lst_ldt&interval=6&units=metric&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Wave tide data failed');
  const data = await res.json();
  const predictions = curveStation !== config.tideStationId && config.tideStationId === '8532337'
    ? transformReferenceCurveForBelmar(data.predictions || [])
    : (data.predictions || []);
  const tideHeightM = interpolatePredictionAtTime(predictions, now);
  if (!Number.isFinite(tideHeightM)) throw new Error('No interpolated tide height');

  return {
    heightAbovePublishedDatumM: tideHeightM,
    publishedDatum: config.tidePredictionDatum,
    publishedDatumToLatOffsetM: config.publishedDatumToLatOffsetM,
    evaluationTime: now.toISOString(),
    sourceFetchTime: now.toISOString()
  };
}

function interpolatePredictionAtTime(predictions, targetTime) {
  const targetTimeMs = targetTime.getTime();
  const parsed = predictions
    .map(prediction => ({
      timeMs: new Date(prediction.t).getTime(),
      heightM: Number.parseFloat(prediction.v)
    }))
    .filter(prediction => Number.isFinite(prediction.timeMs) && Number.isFinite(prediction.heightM))
    .sort((a, b) => a.timeMs - b.timeMs);

  const before = [...parsed].reverse().find(prediction => prediction.timeMs <= targetTimeMs);
  const after = parsed.find(prediction => prediction.timeMs >= targetTimeMs);
  if (!before || !after) return null;
  if (before.timeMs === after.timeMs) return before.heightM;

  return interpolateTideHeight({
    beforeTimeMs: before.timeMs,
    beforeHeightM: before.heightM,
    afterTimeMs: after.timeMs,
    afterHeightM: after.heightM,
    targetTimeMs
  });
}

function estimateNearshoreBreaking({ locationId, locationConfig, offshoreWave, tide, now = getAppNow() }) {
  if (!locationConfig?.enabled) return { status: WAVE_MODEL_STATUS.DISABLED };

  const validationStatus = validateWaveModelInputs({ locationConfig, offshoreWave, tide, now });
  if (validationStatus) return { status: validationStatus };

  try {
    const tideDatum = convertTideToModelDatum({
      heightAbovePublishedDatumM: tide.heightAbovePublishedDatumM,
      publishedDatum: tide.publishedDatum,
      publishedDatumToLatOffsetM: tide.publishedDatumToLatOffsetM,
      modelDatum: locationConfig.profileDatum,
      allowApproximateDatum: locationConfig.allowApproximateDatum
    });

    if (tideDatum.tideAboveLatM < 0) {
      return {
        status: WAVE_MODEL_STATUS.UNSUPPORTED_BELOW_LAT_GEOMETRY,
        metadata: tideDatum
      };
    }

    const offshoreProperties = solveWaveNumber({
      periodS: offshoreWave.periodS,
      depthM: offshoreWave.referenceDepthM
    });
    if (!offshoreProperties.converged) return { status: WAVE_MODEL_STATUS.DISPERSION_FAILED };

    const search = findBreakingPoint({
      locationConfig,
      offshoreWave,
      offshoreGroupVelocityMps: offshoreProperties.groupVelocityMps,
      tideAboveLatM: tideDatum.tideAboveLatM
    });
    if (search.status !== WAVE_MODEL_STATUS.OK) {
      return {
        status: search.status,
        inputs: buildWaveModelInputs(locationConfig, offshoreWave, tideDatum.tideAboveLatM),
        metadata: buildWaveModelMetadata({ locationConfig, offshoreWave, tide, tideDatum, now })
      };
    }

    const currentWaterlineXM = calculateCurrentWaterlineXM({
      tideAboveLatM: tideDatum.tideAboveLatM,
      landwardSlope: locationConfig.landwardSlope
    });
    const breakPointXM = calculateBreakPointXM({
      breakingDepthM: search.point.localDepthM,
      tideAboveLatM: tideDatum.tideAboveLatM,
      offshoreSlope: locationConfig.offshoreSlope
    });

    if (search.point.localDepthM <= tideDatum.tideAboveLatM) {
      return {
        status: WAVE_MODEL_STATUS.BREAKING_CONTOUR_LANDWARD_OF_LAT,
        inputs: buildWaveModelInputs(locationConfig, offshoreWave, tideDatum.tideAboveLatM),
        metadata: buildWaveModelMetadata({ locationConfig, offshoreWave, tide, tideDatum, now })
      };
    }

    return {
      status: WAVE_MODEL_STATUS.OK,
      locationId,
      inputs: buildWaveModelInputs(locationConfig, offshoreWave, tideDatum.tideAboveLatM),
      breaking: {
        distanceFromLatShorelineM: breakPointXM,
        distanceFromCurrentWaterlineM: calculateBreakDistanceFromWaterlineM({
          breakPointXM,
          currentWaterlineXM
        }),
        localDepthM: search.point.localDepthM,
        latBedDepthM: getLatDepthM({
          xM: breakPointXM,
          offshoreSlope: locationConfig.offshoreSlope
        }),
        waveHeightM: search.point.localWaveHeightM,
        wavelengthM: search.point.wavelengthM,
        governingCriterion: search.point.governingCriterion,
        depthLimitedMaxHeightM: search.point.depthLimitedMaxHeightM,
        micheMaxHeightM: search.point.micheMaxHeightM
      },
      shoreline: {
        latReferenceXM: 0,
        currentWaterlineXM,
        currentWaterlineLandwardDistanceM: Math.max(0, -currentWaterlineXM)
      },
      metadata: buildWaveModelMetadata({ locationConfig, offshoreWave, tide, tideDatum, now })
    };
  } catch (error) {
    console.warn('Wave model calculation failed', error);
    return { status: WAVE_MODEL_STATUS.INVALID_INPUT };
  }
}

function validateWaveModelInputs({ locationConfig, offshoreWave, tide, now }) {
  if (!Number.isFinite(offshoreWave?.significantHeightM)) return WAVE_MODEL_STATUS.MISSING_WAVE_HEIGHT;
  if (!Number.isFinite(offshoreWave?.periodS)) return WAVE_MODEL_STATUS.MISSING_WAVE_PERIOD;
  if (!Number.isFinite(offshoreWave?.referenceDepthM)) return WAVE_MODEL_STATUS.MISSING_REFERENCE_DEPTH;
  if (!Number.isFinite(tide?.heightAbovePublishedDatumM)) return WAVE_MODEL_STATUS.MISSING_TIDE;
  if (!Number.isFinite(tide?.publishedDatumToLatOffsetM) && !locationConfig.allowApproximateDatum) {
    return WAVE_MODEL_STATUS.MISSING_TIDE;
  }

  if (
    offshoreWave.significantHeightM < WAVE_MODEL_LIMITS.minWaveHeightM
    || offshoreWave.significantHeightM > WAVE_MODEL_LIMITS.maxWaveHeightM
    || offshoreWave.periodS < WAVE_MODEL_LIMITS.minWavePeriodS
    || offshoreWave.periodS > WAVE_MODEL_LIMITS.maxWavePeriodS
    || offshoreWave.referenceDepthM < WAVE_MODEL_LIMITS.minReferenceDepthM
    || offshoreWave.referenceDepthM > WAVE_MODEL_LIMITS.maxReferenceDepthM
    || locationConfig.offshoreSlope <= 0
    || locationConfig.landwardSlope <= 0
    || locationConfig.maxProfileDepthM <= 0
    || locationConfig.breakerIndexGamma <= 0
  ) {
    return WAVE_MODEL_STATUS.INVALID_INPUT;
  }

  if (isStale(offshoreWave.observationTime, now, WAVE_MODEL_LIMITS.waveDataMaxAgeMinutes)) {
    return WAVE_MODEL_STATUS.STALE_WAVE_DATA;
  }

  if (isStale(tide.evaluationTime, now, WAVE_MODEL_LIMITS.tideDataMaxAgeMinutes)) {
    return WAVE_MODEL_STATUS.STALE_TIDE_DATA;
  }

  return null;
}

function isStale(timeValue, now, maxAgeMinutes) {
  const time = new Date(timeValue);
  if (Number.isNaN(time.getTime())) return true;
  return Math.abs(now.getTime() - time.getTime()) > maxAgeMinutes * 60 * 1000;
}

function convertTideToModelDatum({
  heightAbovePublishedDatumM,
  publishedDatum,
  publishedDatumToLatOffsetM,
  modelDatum,
  allowApproximateDatum
}) {
  const hasOffset = Number.isFinite(publishedDatumToLatOffsetM);
  const tideAboveLatM = hasOffset
    ? heightAbovePublishedDatumM + publishedDatumToLatOffsetM
    : heightAbovePublishedDatumM;

  return {
    tideAboveLatM,
    tideSourceDatum: publishedDatum,
    modelDatum,
    datumOffsetM: hasOffset ? publishedDatumToLatOffsetM : null,
    datumConversionApplied: hasOffset,
    datumApproximate: !hasOffset && Boolean(allowApproximateDatum)
  };
}

function buildWaveModelInputs(locationConfig, offshoreWave, tideAboveLatM) {
  return {
    offshoreWaveHeightM: offshoreWave.significantHeightM,
    wavePeriodS: offshoreWave.periodS,
    offshoreReferenceDepthM: offshoreWave.referenceDepthM,
    tideAboveLatM,
    offshoreSlope: locationConfig.offshoreSlope,
    landwardSlope: locationConfig.landwardSlope,
    breakerIndexGamma: locationConfig.breakerIndexGamma
  };
}

function buildWaveModelMetadata({ locationConfig, offshoreWave, tide, tideDatum, now }) {
  return {
    calculationTime: now.toISOString(),
    waveObservationTime: offshoreWave.observationTime,
    tideEvaluationTime: tide.evaluationTime,
    tideSourceDatum: tideDatum.tideSourceDatum,
    modelDatum: tideDatum.modelDatum,
    datumOffsetM: tideDatum.datumOffsetM,
    datumConversionApplied: tideDatum.datumConversionApplied,
    approximate: tideDatum.datumApproximate,
    assumptions: [
      `uniform 1:${Math.round(1 / locationConfig.offshoreSlope)} submerged profile`,
      `uniform 1:${Math.round(1 / locationConfig.landwardSlope)} exposed beach face`,
      'shore-normal waves',
      'no refraction',
      'no bottom friction before breaking',
      'linear shoaling before breaking'
    ]
  };
}

function findBreakingPoint({ locationConfig, offshoreWave, offshoreGroupVelocityMps, tideAboveLatM }) {
  const maxDistanceOffshoreM = locationConfig.maxProfileDepthM / locationConfig.offshoreSlope;
  const stepM = locationConfig.profileStepM || 1;
  let previous = null;

  for (let xM = maxDistanceOffshoreM; xM >= 0; xM -= stepM) {
    const point = calculateWaveProfilePoint({
      xM,
      locationConfig,
      offshoreWave,
      offshoreGroupVelocityMps,
      tideAboveLatM
    });
    if (!point) continue;

    if (xM === maxDistanceOffshoreM && point.thresholdMarginM <= 0) {
      return { status: WAVE_MODEL_STATUS.ALREADY_BREAKING_AT_OFFSHORE_BOUNDARY };
    }

    if (previous && previous.thresholdMarginM > 0 && point.thresholdMarginM <= 0) {
      return {
        status: WAVE_MODEL_STATUS.OK,
        point: refineBreakingPoint({
          offshorePoint: previous,
          shorewardPoint: point,
          locationConfig,
          offshoreWave,
          offshoreGroupVelocityMps,
          tideAboveLatM
        })
      };
    }

    previous = point;
  }

  return { status: WAVE_MODEL_STATUS.NO_BREAKING_WITHIN_PROFILE };
}

function refineBreakingPoint({
  offshorePoint,
  shorewardPoint,
  locationConfig,
  offshoreWave,
  offshoreGroupVelocityMps,
  tideAboveLatM
}) {
  let high = offshorePoint;
  let low = shorewardPoint;
  const toleranceM = locationConfig.breakDistanceToleranceM || 0.1;

  for (let i = 0; i < 60 && Math.abs(high.xM - low.xM) > toleranceM; i += 1) {
    const midX = (high.xM + low.xM) / 2;
    const mid = calculateWaveProfilePoint({
      xM: midX,
      locationConfig,
      offshoreWave,
      offshoreGroupVelocityMps,
      tideAboveLatM
    });

    if (!mid) break;
    if (mid.thresholdMarginM > 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return low;
}

function calculateWaveProfilePoint({ xM, locationConfig, offshoreWave, offshoreGroupVelocityMps, tideAboveLatM }) {
  const localDepthM = getCurrentOffshoreDepthM({
    xM,
    tideAboveLatM,
    offshoreSlope: locationConfig.offshoreSlope
  });
  if (localDepthM <= 0) return null;

  const waveProperties = solveWaveNumber({
    periodS: offshoreWave.periodS,
    depthM: localDepthM
  });
  if (!waveProperties.converged) throw new Error('Dispersion did not converge');

  const localWaveHeightM = calculateShoaledWaveHeightM({
    offshoreWaveHeightM: offshoreWave.significantHeightM,
    offshoreGroupVelocityMps,
    localGroupVelocityMps: waveProperties.groupVelocityMps
  });
  const limits = calculateBreakingLimits({
    localWaveHeightM,
    localDepthM,
    wavelengthM: waveProperties.wavelengthM,
    waveNumberRadPerM: waveProperties.waveNumberRadPerM,
    gamma: locationConfig.breakerIndexGamma
  });

  return {
    xM,
    localDepthM,
    localWaveHeightM,
    wavelengthM: waveProperties.wavelengthM,
    ...limits
  };
}

function getLatDepthM({ xM, offshoreSlope }) {
  if (xM < 0) throw new RangeError('LAT offshore depth requires x >= 0');
  return xM * offshoreSlope;
}

function getBedElevationRelativeToLatM({ xM, offshoreSlope, landwardSlope }) {
  return -(xM >= 0 ? offshoreSlope : landwardSlope) * xM;
}

function getCurrentOffshoreDepthM({ xM, tideAboveLatM, offshoreSlope }) {
  if (xM < 0) throw new RangeError('Offshore depth calculation requires x >= 0');
  return xM * offshoreSlope + tideAboveLatM;
}

function calculateCurrentWaterlineXM({ tideAboveLatM, landwardSlope }) {
  if (landwardSlope <= 0) throw new RangeError('Landward slope must be positive');
  return -tideAboveLatM / landwardSlope;
}

function calculateBreakPointXM({ breakingDepthM, tideAboveLatM, offshoreSlope }) {
  if (offshoreSlope <= 0) throw new RangeError('Offshore slope must be positive');
  return (breakingDepthM - tideAboveLatM) / offshoreSlope;
}

function calculateBreakDistanceFromWaterlineM({ breakPointXM, currentWaterlineXM }) {
  return breakPointXM - currentWaterlineXM;
}

function solveWaveNumber({ periodS, depthM, gravityMps2 = GRAVITY_MPS2 }) {
  if (periodS <= 0 || depthM <= 0) throw new RangeError('Wave period and depth must be positive');

  const omega = TWO_PI / periodS;
  let k = omega * omega / gravityMps2;
  const shallowEstimate = omega / Math.sqrt(gravityMps2 * depthM);
  if (k * depthM < 1) k = shallowEstimate;

  const maxIterations = 50;
  const relativeTolerance = 1e-10;
  const absoluteTolerance = 1e-12;
  let converged = false;
  let iterations = 0;

  for (; iterations < maxIterations; iterations += 1) {
    const kh = k * depthM;
    const tanhKh = Math.tanh(kh);
    const sechSquaredKh = 1 / Math.cosh(Math.min(kh, 350)) ** 2;
    const f = gravityMps2 * k * tanhKh - omega * omega;
    const df = gravityMps2 * tanhKh + gravityMps2 * k * depthM * sechSquaredKh;
    if (!Number.isFinite(f) || !Number.isFinite(df) || df === 0) break;

    const nextK = k - f / df;
    if (!Number.isFinite(nextK) || nextK <= 0) break;

    if (Math.abs(nextK - k) <= Math.max(absoluteTolerance, relativeTolerance * Math.abs(k))) {
      k = nextK;
      converged = true;
      break;
    }

    k = nextK;
  }

  const kh = k * depthM;
  const wavelengthM = TWO_PI / k;
  const phaseVelocityMps = omega / k;
  const groupTerm = 2 * kh > 350 ? 0 : (2 * kh) / Math.sinh(2 * kh);
  const groupCoefficient = 0.5 * (1 + groupTerm);
  const groupVelocityMps = groupCoefficient * phaseVelocityMps;

  return {
    waveNumberRadPerM: k,
    wavelengthM,
    phaseVelocityMps,
    groupCoefficient,
    groupVelocityMps,
    kh,
    iterations: iterations + 1,
    converged: converged && [k, wavelengthM, phaseVelocityMps, groupCoefficient, groupVelocityMps].every(Number.isFinite)
  };
}

function calculateShoaledWaveHeightM({ offshoreWaveHeightM, offshoreGroupVelocityMps, localGroupVelocityMps }) {
  if (offshoreWaveHeightM <= 0 || offshoreGroupVelocityMps <= 0 || localGroupVelocityMps <= 0) {
    throw new RangeError('Invalid shoaling inputs');
  }

  return offshoreWaveHeightM * Math.sqrt(offshoreGroupVelocityMps / localGroupVelocityMps);
}

function calculateBreakingLimits({ localWaveHeightM, localDepthM, wavelengthM, waveNumberRadPerM, gamma }) {
  const depthLimitedMaxHeightM = gamma * localDepthM;
  const micheMaxHeightM = 0.142 * wavelengthM * Math.tanh(waveNumberRadPerM * localDepthM);
  const governingMaxHeightM = Math.min(depthLimitedMaxHeightM, micheMaxHeightM);

  return {
    depthLimitedMaxHeightM,
    micheMaxHeightM,
    governingMaxHeightM,
    governingCriterion: depthLimitedMaxHeightM <= micheMaxHeightM ? 'depth' : 'steepness',
    thresholdMarginM: governingMaxHeightM - localWaveHeightM
  };
}

function interpolateTideHeight({ beforeTimeMs, beforeHeightM, afterTimeMs, afterHeightM, targetTimeMs }) {
  if (afterTimeMs <= beforeTimeMs) throw new RangeError('Tide interpolation times are invalid');
  const fraction = (targetTimeMs - beforeTimeMs) / (afterTimeMs - beforeTimeMs);
  return beforeHeightM + fraction * (afterHeightM - beforeHeightM);
}

function metersToFeet(m) {
  return m * 3.280839895;
}

function feetToMeters(ft) {
  return ft / 3.280839895;
}

function metersToYards(m) {
  return m * 1.093613298;
}

function formatFeet(m) {
  return `${roundToNearest(metersToFeet(m), 0.1).toFixed(1)} ft`;
}

function roundToNearest(value, increment) {
  return Math.round(value / increment) * increment;
}

async function fetchWaterTempSource(source) {
  if (!source) throw new Error('Water temp source missing');

  if (source.provider === 'coops') {
    return fetchCoopsWaterTemp(source);
  }

  if (source.provider === 'ndbc') {
    return fetchNdbcWaterTemp(source);
  }

  if (source.provider === 'safeBeachDay') {
    return fetchSafeBeachDayWaterTemp(source);
  }

  throw new Error(`Unsupported water temp provider: ${source.provider}`);
}

async function fetchCoopsWaterTemp(source) {
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_temperature&application=beach-app&station=${source.stationId}&date=latest&units=english&time_zone=lst_ldt&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Water temp failed');
  const data = await res.json();
  const reading = data.data?.[0];
  if (!reading?.v) throw new Error('No water temp in feed');
  const temperature = Number.parseFloat(reading.v);
  if (!Number.isFinite(temperature)) throw new Error('Invalid water temp in feed');

  return {
    temperature: Math.round(temperature),
    label: source.label || `NOAA station ${source.stationId}`,
    time: reading.t
  };
}

async function fetchNdbcWaterTemp(source) {
  const url = `https://www.ndbc.noaa.gov/data/realtime2/${source.stationId}.txt`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Water temp failed');
  const text = await res.text();
  const reading = parseNdbcWaterTemp(text);
  if (!reading) throw new Error('No water temp in buoy feed');

  return {
    temperature: Math.round(convertCelsiusToFahrenheit(reading.temperatureC)),
    label: source.label || `NOAA buoy ${source.stationId}`,
    time: reading.time
  };
}

function parseNdbcWaterTemp(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const headerLine = lines.find(line => line.startsWith('#YY') || line.startsWith('#yr'));
  if (!headerLine) return null;

  const columns = headerLine.replace(/^#/, '').trim().split(/\s+/);
  const waterTempIndex = columns.indexOf('WTMP');
  if (waterTempIndex < 0) return null;

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const values = line.split(/\s+/);
    const temperatureC = Number.parseFloat(values[waterTempIndex]);
    if (!Number.isFinite(temperatureC)) continue;

    const year = Number.parseInt(values[0], 10);
    const month = Number.parseInt(values[1], 10);
    const day = Number.parseInt(values[2], 10);
    const hour = Number.parseInt(values[3], 10);
    const minute = Number.parseInt(values[4], 10);

    return {
      temperatureC,
      time: new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString()
    };
  }

  return null;
}

async function fetchAltWaterTempSource(source) {
  if (!source) return null;

  try {
    if (source.provider === 'safeBeachDay') {
      return await fetchSafeBeachDayWaterTemp(source);
    }
  } catch (error) {
    console.warn('Alt water temp failed', error);
  }

  return null;
}

async function fetchSafeBeachDayWaterTemp(source) {
  const res = await fetch('https://api-yourwatchtower.graphcdn.app/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'query GetWeatherData($weatherInput: [WeatherInput!]!) { getWeatherData(weatherInput: $weatherInput) }',
      variables: {
        weatherInput: [{
          useMeters: false,
          useCelsius: false,
          surflineSpotId: source.surflineSpotId,
          ndbcBuoyId: source.ndbcBuoyId,
          noaaTidesStation: source.noaaTidesStation,
          agencyTz: source.agencyTz,
          latitude: source.latitude,
          longitude: source.longitude
        }]
      }
    })
  });

  if (!res.ok) throw new Error('Alt water temp failed');
  const data = await res.json();
  const reading = data.data?.getWeatherData?.[0]?.waterTemperature;
  const value = Number.parseFloat(reading?.value);
  if (!Number.isFinite(value)) throw new Error('No alt water temp in feed');

  return {
    temperature: Math.round(value),
    label: source.label || 'Surfline'
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderTideChart(points, beach, selectedDate) {
  const chartEl = document.getElementById('tideChart');
  if (!chartEl) return;

  if (!points.length) {
    chartEl.innerHTML = '<div style="padding:12px;color:#64748b;">Tide curve unavailable.</div>';
    return;
  }

  const parsed = points
  .map(p => ({
    t: p.t instanceof Date ? p.t : new Date(p.t),
    v: typeof p.v === 'number' ? p.v : Number.parseFloat(p.v)
  }))
  .filter(p => !Number.isNaN(p.t.getTime()) && Number.isFinite(p.v));

  if (!parsed.length) {
    chartEl.innerHTML = '<div style="padding:12px;color:#64748b;">Tide curve unavailable.</div>';
    return;
  }

  // The tide chart is tuned for mobile readability first, with larger labels
  // on smaller screens so it stays legible in the field.
const width = 640;
const height = 220;
const pad = { top: 16, right: 14, bottom: 34, left: 40 };
const isPhone = window.innerWidth <= 600;
const fontSmall = isPhone ? 24 : 11;
const fontMedium = isPhone ? 28 : 12;
const innerWidth = width - pad.left - pad.right;
const innerHeight = height - pad.top - pad.bottom;

  const minT = Math.min(...parsed.map(p => p.t.getTime()));
  const maxT = Math.max(...parsed.map(p => p.t.getTime()));
  const minVRaw = Math.min(...parsed.map(p => p.v));
  const maxVRaw = Math.max(...parsed.map(p => p.v));
  const spread = Math.max(0.5, maxVRaw - minVRaw);
  const minV = Math.floor((minVRaw - spread * 0.1) * 10) / 10;
  const maxV = Math.ceil((maxVRaw + spread * 0.1) * 10) / 10;

  const x = t => pad.left + ((t - minT) / (maxT - minT || 1)) * innerWidth;
  const y = v => pad.top + (1 - (v - minV) / (maxV - minV || 1)) * innerHeight;

  const linePath = parsed.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t.getTime()).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(parsed[parsed.length - 1].t.getTime()).toFixed(1)} ${(height - pad.bottom).toFixed(1)} L ${x(parsed[0].t.getTime()).toFixed(1)} ${(height - pad.bottom).toFixed(1)} Z`;

  const now = getAppNow();
  const nowX = now >= new Date(minT) && now <= new Date(maxT) ? x(now.getTime()) : null;

  const yTicks = 4;
  const axisStart = new Date(selectedDate);
axisStart.setHours(0, 0, 0, 0);

const xTickHours = [0, 6, 12, 18, 24].map(h => {
  const dt = new Date(axisStart);
  dt.setHours(h, 0, 0, 0);
  return dt;
});

  const circles = parsed
    .filter((_, i) => i % 20 === 0)
    .map(p => `<circle cx="${x(p.t.getTime()).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="1.8" fill="#0f766e" />`)
    .join('');

  const yGrid = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minV + ((maxV - minV) * i) / yTicks;
    const py = y(val);
    return `
  <line x1="${pad.left}" y1="${py.toFixed(1)}" x2="${width - pad.right}" y2="${py.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />
  <text x="${pad.left - 6}" y="${(py + 4).toFixed(1)}" text-anchor="end" font-size="${fontSmall}" fill="#64748b">${val.toFixed(1)}</text>
`;
  }).join('');

 const xGrid = xTickHours.map(dt => {
  const px = x(dt.getTime());
  return `
  <line x1="${px.toFixed(1)}" y1="${pad.top}" x2="${px.toFixed(1)}" y2="${height - pad.bottom}" stroke="#e2e8f0" stroke-width="1" />
  <text x="${px.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="${fontSmall}" fill="#64748b">${dt.toLocaleTimeString([], { hour: 'numeric' })}</text>
`;
}).join('');

chartEl.innerHTML = `
<svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" role="img" aria-label="Tide curve for ${beach.displayName} on ${formatLongDate(selectedDate)}">      <defs>
        <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#93c5fd" stop-opacity="0.65" />
          <stop offset="100%" stop-color="#dbeafe" stop-opacity="0.2" />
        </linearGradient>
      </defs>
      ${yGrid}
      ${xGrid}
      <path d="${areaPath}" fill="url(#tideFill)" />
      <path d="${linePath}" fill="none" stroke="#0284c7" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      ${circles}
      ${nowX ? `<line x1="${nowX.toFixed(1)}" y1="${pad.top}" x2="${nowX.toFixed(1)}" y2="${height - pad.bottom}" stroke="#ef4444" stroke-width="2" stroke-dasharray="5 4" />
<text x="${Math.min(width - 28, nowX + 6).toFixed(1)}" y="${pad.top + 12}" font-size="${fontSmall}" fill="#b91c1c">Now</text>` : ''}
<text x="${width / 2}" y="20" text-anchor="middle" font-size="${fontMedium}" fill="#334155">Height in feet</text>
    </svg>
  `;
}

function tideLabel(type) {
  return type === 'H' ? 'High' : 'Low';
}

function formatLocalTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatTimeNoSeconds(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatCompactHour(value) {
  const date = new Date(value);
  const hour = date.getHours();
  const suffix = hour >= 12 ? 'p' : 'a';
  const hour12 = hour % 12 || 12;
  return `${hour12}${suffix}`;
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatLongDate(value) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function formatYmd(date) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('');
}

function getLocalDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

init();
