const APP_VERSION = 'v1.3.6';
const BEACHES = [
  {
    id: 'sandy-hook',
    name: 'Sandy Hook',
    lat: 40.466,
    lon: -74.009,
    tideStation: '8531680',
    waterTempStation: '8531680'
  },
  {
    id: 'belmar',
    name: 'Belmar Beach',
    lat: 40.178,
    lon: -74.021,
    tideStation: '8532337',
    waterTempStation: '8531680'
  }
];

const beachSelect = document.getElementById('beachSelect');
const statusEl = document.getElementById('status');
const airTempEl = document.getElementById('airTemp');
const windEl = document.getElementById('wind');
const weatherUpdatedEl = document.getElementById('weatherUpdated');
const weatherFeelsEl = ensureWeatherFeelsEl();
const weatherRangeEl = ensureWeatherRangeEl();
const waterTempEl = document.getElementById('waterTemp');
const waterUpdatedEl = document.getElementById('waterUpdated');
const nextTideEl = document.getElementById('nextTide');
const moonPhaseEl = document.getElementById('moonPhase');
const tideListEl = document.getElementById('tideList');
const notesListEl = document.getElementById('notesList');
const LAST_BEACH_KEY = 'beach-app-last-beach';

// --- Helpers ---
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

  const now = new Date();
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

  let best = null;

  for (const h of hours) {
    if (h.probabilityOfPrecipitation?.value < threshold) continue;

    const severity = getPrecipSeverity(h.shortForecast);
    if (!severity) continue;

    if (!best || rankSeverity(severity) > rankSeverity(best.severity)) {
      best = {
        severity,
        time: new Date(h.startTime)
      };
    }
  }

  if (!best) return null;

  const now = new Date();
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
    ripCurrentNote(data.alerts),
    windShiftNote(data.hourly),
    precipitation,
    sealNote(data.beach, data.current, precipitation)
  ]
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  return notes;
}

function init() {
  addVersionTag();
  ensureTideChartContainer();

  BEACHES.forEach(beach => {
    const option = document.createElement('option');
    option.value = beach.id;
    option.textContent = beach.name;
    beachSelect.appendChild(option);
  });

  const savedBeach = localStorage.getItem(LAST_BEACH_KEY);
  if (savedBeach && BEACHES.some(b => b.id === savedBeach)) {
    beachSelect.value = savedBeach;
  }

  if (!beachSelect.value) {
    beachSelect.value = BEACHES[0].id;
  }

  beachSelect.addEventListener('change', () => {
    localStorage.setItem(LAST_BEACH_KEY, beachSelect.value);
    loadBeach();
  });

  loadBeach();
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

function getSelectedBeach() {
  return BEACHES.find(b => b.id === beachSelect.value) || BEACHES[0];
}

async function loadBeach() {
  const beach = getSelectedBeach();
  statusEl.textContent = `Loading ${beach.name}…`;
  try {
    await Promise.all([
      loadWeather(beach),
      loadTides(beach),
      loadWaterTemp(beach),
      loadAlerts(beach) 
    ]);
    
const notes = buildBeachNotes({
    beach,
    current: latestHourlyPeriods[0],
    hourly: latestHourlyPeriods,
    alerts: latestAlerts 
  });
  renderNotes(notes);

    moonPhaseEl.textContent = `Moon: ${getMoonPhase()}`;
    statusEl.textContent = `${beach.name} updated.`;
  } catch (error) {
    console.error(error);
    statusEl.textContent = 'Some data failed to load. Try refresh.';
  }
}

async function loadWeather(beach) {
  const pointsRes = await fetch(`https://api.weather.gov/points/${beach.lat},${beach.lon}`, {
    headers: { Accept: 'application/geo+json' }
  });
  if (!pointsRes.ok) throw new Error('Weather points failed');
  const pointsData = await pointsRes.json();

  const forecastRes = await fetch(pointsData.properties.forecastHourly, {
    headers: { Accept: 'application/geo+json' }
  });
  if (!forecastRes.ok) throw new Error('Hourly forecast failed');
  const forecastData = await forecastRes.json();
  latestHourlyPeriods = forecastData.properties.periods || [];
  const current = forecastData.properties.periods?.[0];
  if (!current) throw new Error('No forecast periods returned');

  airTempEl.textContent = `${current.temperature}°${current.temperatureUnit}`;
  windEl.textContent = `${current.windDirection} ${current.windSpeed}`;
  renderWeatherFeels(current);
  weatherUpdatedEl.textContent = `Forecast starts ${formatDateTime(current.startTime)}`;
  renderWeatherRange(latestHourlyPeriods, current.temperatureUnit);
}

function renderWeatherFeels(period) {
  const comfort = getBeachComfortLabel(period);
  weatherFeelsEl.textContent = comfort ? `Feels: ${comfort}` : '';
}

function getBeachComfortLabel(period) {
  const temperature = period?.temperature;
  const humidity = period?.relativeHumidity?.value;
  const windSpeed = parseWindSpeed(period?.windSpeed);

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

  if (temperature >= 75 && Number.isFinite(humidity)) {
    if (humidity >= 80) {
      level += 2;
    } else if (humidity >= 70) {
      level += 1;
    }
  }

  level = Math.max(0, Math.min(level, labels.length - 1));
  const label = labels[level];

  if (label === 'Hot' && humidity >= 70) {
    return 'Hot & humid';
  }

  return label;
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

function sealNote(beach, currentPeriod, precipitation) {
  if (beach?.id !== 'sandy-hook') return null;
  if (!isSealSeason()) return null;

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

function isSealSeason(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();

  if ([0, 1, 2, 3, 11].includes(month)) return true;
  return month === 10 && day >= 20;
}

function renderWeatherRange(periods, temperatureUnit) {
  const range = findDailyTemperatureRange(periods);
  if (!range) {
    weatherRangeEl.innerHTML = '';
    return;
  }

  weatherRangeEl.innerHTML = `
    <div>Daytime High ${range.high.temperature}°${temperatureUnit} at ${formatHourLabel(range.high.startTime)}</div>
    <div>Daytime Low ${range.low.temperature}°${temperatureUnit} at ${formatHourLabel(range.low.startTime)}</div>
  `;
}

function findDailyTemperatureRange(periods) {
  const candidates = getRangeCandidates(periods);
  if (!candidates.length) return null;

  let high = candidates[0];
  let low = candidates[0];

  for (const period of candidates.slice(1)) {
    if (period.temperature > high.temperature) high = period;
    if (period.temperature < low.temperature) low = period;
  }

  return { high, low };
}

function getRangeCandidates(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return [];

  const validPeriods = periods.filter(period =>
    Number.isFinite(period?.temperature) && !Number.isNaN(new Date(period.startTime).getTime())
  );
  if (!validPeriods.length) return [];

  const now = new Date();
  const daytimePeriods = validPeriods.filter(period => isDaytimeForecastHour(period.startTime, now));
  return daytimePeriods.length ? daytimePeriods : validPeriods.slice(0, 24);
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
  try {
    const url = `https://api.weather.gov/alerts/active?point=${beach.lat},${beach.lon}`;
    const res = await fetch(url);
    const data = await res.json();

    latestAlerts = data.features || [];
  } catch (err) {
    console.error("Alerts fetch failed", err);
    latestAlerts = [];
  }
}


function getMoonPhase(date = new Date()) {

  const synodicMonth = 29.53058867;
  const knownNewMoon = new Date('2000-01-06T18:14:00Z');

  const days = (date - knownNewMoon) / 86400000;
  const age = days % synodicMonth;

  if (age < 1.84566) return "🌑 New Moon";
  if (age < 5.53699) return "🌒 Waxing Crescent";
  if (age < 9.22831) return "🌓 First Quarter";
  if (age < 12.91963) return "🌔 Waxing Gibbous";
  if (age < 16.61096) return "🌕 Full Moon";
  if (age < 20.30228) return "🌖 Waning Gibbous";
  if (age < 23.99361) return "🌗 Last Quarter";
  if (age < 27.68493) return "🌘 Waning Crescent";

  return "🌑 New Moon";
}

async function loadTides(beach) {
  const today = new Date();
  const beginDate = formatYmd(today);
  const endDate = formatYmd(today);

  const hiloUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=beach-app&begin_date=${beginDate}&end_date=${endDate}&datum=MLLW&station=${beach.tideStation}&time_zone=lst_ldt&interval=hilo&units=english&format=json`;
  const curveStation = beach.id === 'belmar' ? '8531680' : beach.tideStation;
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
    renderTideChart([], beach);
    return;
  }

  const now = new Date();
  const next = predictions.find(p => new Date(p.t) > now) || predictions[predictions.length - 1];
  nextTideEl.textContent = `Next tide: ${tideLabel(next.type)} at ${formatLocalTime(next.t)}`;

  predictions.forEach(prediction => {
    const item = document.createElement('div');
    item.className = 'tide-item';
    item.innerHTML = `
      <span class="tide-type ${prediction.type === 'H' ? 'high' : 'low'}">${tideLabel(prediction.type)}</span>
      <span>${formatLocalTime(prediction.t)}${prediction.v ? ` · ${prediction.v} ft` : ''}</span>
    `;
    tideListEl.appendChild(item);
  });

  if (beach.id === 'belmar' && curvePoints.length) {
    curvePoints = transformReferenceCurveForBelmar(curvePoints);
  }

  if (!curvePoints.length) {
    curvePoints = buildCurveFromHiLo(predictions);
  }

  renderTideChart(curvePoints, beach);
}

function buildCurveFromHiLo(predictions) {
  const parsed = predictions
    .map(p => ({
      t: new Date(p.t),
      v: Number.parseFloat(p.v),
      type: p.type
    }))
    .filter(p => !Number.isNaN(p.t.getTime()) && Number.isFinite(p.v));

  if (parsed.length < 2) return [];

  const points = [];
  const sixMinutesMs = 6 * 60 * 1000;
  const dayStart = new Date(parsed[0].t);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(24, 0, 0, 0);

  const anchors = [...parsed];

  if (anchors[0].t > dayStart && anchors.length >= 2) {
    const next = anchors[0];
    const after = anchors[1];
    anchors.unshift({
      t: dayStart,
      v: estimateBoundaryValue(dayStart, next, after)
    });
  }

  const last = anchors[anchors.length - 1];
  if (last.t < dayEnd && anchors.length >= 2) {
    const prev = anchors[anchors.length - 2];
    anchors.push({
      t: dayEnd,
      v: estimateBoundaryValue(dayEnd, prev, last)
    });
  }

  for (let i = 0; i < anchors.length - 1; i++) {
    const start = anchors[i];
    const end = anchors[i + 1];
    const span = end.t.getTime() - start.t.getTime();
    if (span <= 0) continue;

    for (let ts = start.t.getTime(); ts < end.t.getTime(); ts += sixMinutesMs) {
      const progress = (ts - start.t.getTime()) / span;
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * progress);
      const value = start.v + (end.v - start.v) * eased;
      points.push({
        t: new Date(ts).toISOString().slice(0, 19),
        v: value.toFixed(2)
      });
    }
  }

  const finalAnchor = anchors[anchors.length - 1];
  points.push({
    t: finalAnchor.t.toISOString().slice(0, 19),
    v: finalAnchor.v.toFixed(2)
  });

  return points;
}

function estimateBoundaryValue(boundary, a, b) {
  const total = b.t.getTime() - a.t.getTime();
  if (total <= 0) return a.v;
  const ratio = (boundary.getTime() - a.t.getTime()) / total;
  return a.v + (b.v - a.v) * ratio;
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
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_temperature&application=beach-app&station=${beach.waterTempStation}&date=latest&units=english&time_zone=lst_ldt&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Water temp failed');
  const data = await res.json();
  const reading = data.data?.[0];
  if (!reading?.v) throw new Error('No water temp in feed');

  waterTempEl.textContent = `${reading.v}°F`;
  waterUpdatedEl.textContent = `NOAA station ${beach.waterTempStation} at ${formatDateTime(reading.t)}`;
}

function renderTideChart(points, beach) {
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

  const now = new Date();
  const nowX = now >= new Date(minT) && now <= new Date(maxT) ? x(now.getTime()) : null;

  const yTicks = 4;
  const axisStart = new Date();
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
<svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" role="img" aria-label="Today's tide curve for ${beach.name}">      <defs>
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

function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function formatYmd(date) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

init();
