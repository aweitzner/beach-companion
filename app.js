const APP_VERSION = 'v1.5.15';
const queryParams = new URLSearchParams(window.location.search);
const TEST_MODE = queryParams.get('testMode') === '1';
const TEST_MODE_CONFIG = Object.freeze({
  enabled: TEST_MODE,
  simNowRaw: queryParams.get('simNow'),
  weatherFixture: queryParams.get('weatherFixture'),
  alertsFixture: queryParams.get('alertsFixture'),
  tidesFixture: queryParams.get('tidesFixture'),
  waterTempFixture: queryParams.get('waterTempFixture'),
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
const BEACHES = [
  {
    id: 'sandy_hook',
    displayName: 'Sandy Hook, NJ',
    lat: 40.4668,
    lon: -74.0093,
    tideStationId: '8531680',
    waterTempStationId: '8531680'
  },
  {
    id: 'belmar',
    displayName: 'Belmar, NJ',
    lat: 40.1784,
    lon: -74.0210,
    tideStationId: '8532337',
    waterTempStationId: '8532337'
  },
  {
    id: 'asbury_park',
    displayName: 'Asbury Park, NJ',
    lat: 40.2204,
    lon: -73.9982,
    tideStationId: '8532337',
    waterTempStationId: '8532337'
  },
  {
    id: 'cape_may',
    displayName: 'Cape May, NJ',
    lat: 38.9351,
    lon: -74.9060,
    tideStationId: '8536110',
    waterTempStationId: '8536110'
  },
  {
    id: 'bar_harbor',
    displayName: 'Bar Harbor, ME',
    lat: 44.3876,
    lon: -68.2039,
    tideStationId: '8413320',
    waterTempStationId: '8413320'
  }
];

const beachSelect = document.getElementById('beachSelect');
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
const sunriseTimeEl = document.getElementById('sunriseTime');
const sunsetTimeEl = document.getElementById('sunsetTime');
const moonriseTimeEl = document.getElementById('moonriseTime');
const moonsetTimeEl = document.getElementById('moonsetTime');
const windChartEl = document.getElementById('windChart');
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
let activeDateKey = getLocalDateKey(getAppNow());
let selectedDayKey = activeDateKey;

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
    priority: 3
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
  const priority = best.severity === 'Thunderstorms' ? 1 : 4;

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
    data.isToday ? ripCurrentNote(data.alerts) : null,
    windShiftNote(data.hourly),
    precipitation,
    sealNote(data.beach, data.current, precipitation, data.date),
    clothingNote(data.date, data.range, data.strongestWindSpeed),
    fullMoonRiseNote(data.astronomy)
  ]
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

  const results = await Promise.allSettled([
    loadWeather(beach, selectedDate),
    loadTides(beach, selectedDate),
    loadWaterTemp(beach),
    loadAlerts(beach)
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
  return dayPeriods.filter(period => new Date(period.startTime) >= now);
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

function renderWindChart(periods, beach, selectedDate) {
  if (!periods.length) {
    windSummaryEl.textContent = '';
    renderWindDiagram(beach, null, selectedDate);
    windChartEl.textContent = 'Wind chart unavailable.';
    return;
  }

  // The chart is intentionally simple: one daytime bar per hour, a direction
  // arrow above each bar, and a highlight for the first strongest-wind hour.
  const width = 640;
  const height = 232;
  const isPhone = window.innerWidth <= 600;
  const fontSmall = isPhone ? 24 : 11;
  const fontMedium = isPhone ? 18 : 10;
  const pad = { top: 48, right: 12, bottom: 34, left: 34 };
  const maxSpeed = Math.max(...periods.map(period => period.speed));
  const chartMax = Math.max(10, Math.ceil(maxSpeed / 5) * 5);
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const barWidth = innerWidth / periods.length;
  const labelEvery = periods.length > 8 ? 2 : 1;
  const maxIndex = periods.findIndex(period => period.speed === maxSpeed);
  const summary = getWindTrendSummary(periods);
  const peakPeriod = periods[maxIndex] || null;
  windSummaryEl.textContent = summary;
  renderWindDiagram(beach, peakPeriod, selectedDate);
  const y = speed => pad.top + innerHeight - (speed / chartMax) * innerHeight;

  const yLabels = [0, Math.round(chartMax / 2), chartMax];
  const yGrid = yLabels.map(value => `
    <line x1="${pad.left}" y1="${y(value).toFixed(1)}" x2="${width - pad.right}" y2="${y(value).toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />
    <text x="${pad.left - 6}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end" font-size="${fontSmall}" fill="#64748b">${value}</text>
  `).join('');

  const bars = periods.map((period, index) => {
    const x = pad.left + index * barWidth + barWidth * 0.15;
    const w = barWidth * 0.7;
    const top = y(period.speed);
    const barHeight = innerHeight - (top - pad.top);
    const fill = index === maxIndex ? '#3b82f6' : '#60a5fa';
    const arrow = Number.isFinite(period.directionDeg)
      ? renderWindArrow(x + w / 2, top - 14, period.directionDeg)
      : '';
    const label = index % labelEvery === 0
      ? `<text x="${(x + w / 2).toFixed(1)}" y="${height - 10}" text-anchor="middle" font-size="${fontSmall}" fill="#64748b">${formatCompactHour(period.startTime)}</text>`
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
        ${label}
      </g>
    `;
  }).join('');

  const chartAriaLabel = peakPeriod
    ? `${summary}. Daytime wind for ${beach.displayName} on ${formatLongDate(selectedDate)}. Peak wind ${peakPeriod.speed} mph around ${formatTimeNoSeconds(peakPeriod.startTime)}.`
    : `${summary}. Daytime wind for ${beach.displayName} on ${formatLongDate(selectedDate)}.`;

  windChartEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" role="img" aria-label="${chartAriaLabel}">
      ${yGrid}
      ${bars}
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
        <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,0.92)" stroke="rgba(15,23,42,0.12)" stroke-width="1" />
        <text x="12" y="8.6" text-anchor="middle" font-size="6.5" font-weight="700" fill="#0f172a">N</text>
        <path d="M 12 18 L 8.9 12.3 L 12 5.8 L 15.1 12.3 Z" fill="#0f172a" />
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

function getClothingRecommendation(selectedDate, range, strongestWindSpeed) {
  // Clothing is treated as an action-oriented Beach Note, not a core condition.
  // The rules are deterministic and conservative: start from daytime high,
  // then get colder if the low or strongest daytime wind suggest it.
  if (!range) return null;

  const high = range.high.temperature;
  const low = range.low.temperature;

  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;

  const beachMode = isBeachMode(selectedDate);
  const labels = beachMode
    ? ['You’ll be good in a T-shirt', 'You may want a long sleeve', 'Bring a sweatshirt', 'Bring layers if you’re staying late']
    : ['You’ll be fine with a light layer', 'Bring a sweatshirt', 'You’ll want a coat', 'Bundle up out there'];

  let level;

  if (beachMode) {
    if (high >= 80) level = 0;
    else if (high >= 70) level = 1;
    else if (high >= 60) level = 2;
    else level = 3;

    if (low < 50) level = 3;
    else if (low < 60) level = Math.max(level, 2);
  } else {
    if (high >= 65) level = 0;
    else if (high >= 55) level = 1;
    else if (high >= 40) level = 2;
    else level = 3;

    if (low < 32) level = 3;
    else if (low < 40) level = Math.max(level, 2);
    else if (low < 50) level = Math.max(level, 1);
  }

  if (Number.isFinite(strongestWindSpeed) && strongestWindSpeed >= 15) {
    level += 1;
  }

  level = Math.max(0, Math.min(level, labels.length - 1));
  return labels[level];
}

function clothingNote(selectedDate, range, strongestWindSpeed) {
  const clothing = getClothingRecommendation(selectedDate, range, strongestWindSpeed);
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
  const strongestWindSpeed = getStrongestDaytimeWindSpeed(gridWindPeriods, latestHourlyPeriods, selectedDate);
  latestRangePeriods = rangePeriods;
  latestStrongestDaytimeWindSpeed = strongestWindSpeed;
  renderWindChart(
    getWindChartPeriods(gridWindPeriods, gridDirectionPeriods, latestHourlyPeriods, selectedDate),
    beach,
    selectedDate
  );
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

async function loadWaterTemp(beach) {
  const stationIds = getWaterTempStationCandidates(beach);
  let lastError = null;

  for (const stationId of stationIds) {
    try {
      const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_temperature&application=beach-app&station=${stationId}&date=latest&units=english&time_zone=lst_ldt&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Water temp failed');
      const data = await res.json();
      const reading = data.data?.[0];
      if (!reading?.v) throw new Error('No water temp in feed');

      waterTempEl.textContent = `${reading.v}°F`;
      waterUpdatedEl.textContent = `NOAA station ${stationId} at ${formatDateTime(reading.t)}`;
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Water temp failed');
}

function getWaterTempStationCandidates(beach) {
  const candidates = [beach.waterTempStationId];

  if (beach?.id === 'belmar' || beach?.id === 'asbury_park') {
    candidates.push('8531680');
  }

  return [...new Set(candidates)];
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
