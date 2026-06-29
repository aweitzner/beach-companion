const APP_VERSION = 'v0.1.6';
const UNIT_SYSTEMS = Object.freeze({
  metric: 'metric',
  imperial: 'imperial'
});
const LOCATION = Object.freeze({
  id: 'sao_miguel',
  displayName: 'Sao Miguel, Azores',
  subtitle: 'Ponta Delgada / south coast',
  lat: 37.7412,
  lon: -25.6756,
  timezone: 'Atlantic/Azores'
});

const locationSelectEl = document.getElementById('locationSelect');
const metricButtonEl = document.getElementById('metricButton');
const imperialButtonEl = document.getElementById('imperialButton');
const statusEl = document.getElementById('status');
const daySelectorEl = document.getElementById('daySelector');
const notesListEl = document.getElementById('notesList');
const weatherCardTitleEl = document.getElementById('weatherCardTitle');
const airLabelEl = document.getElementById('airLabel');
const windLabelEl = document.getElementById('windLabel');
const airTempEl = document.getElementById('airTemp');
const windEl = document.getElementById('wind');
const weatherFeelsEl = document.getElementById('weatherFeels');
const weatherRangeEl = document.getElementById('weatherRange');
const weatherUpdatedEl = document.getElementById('weatherUpdated');
const waveHeightEl = document.getElementById('waveHeight');
const wavePeriodEl = document.getElementById('wavePeriod');
const waveDirectionEl = document.getElementById('waveDirection');
const seaTempEl = document.getElementById('seaTemp');
const seaUpdatedEl = document.getElementById('seaUpdated');
const sunriseTimeEl = document.getElementById('sunriseTime');
const sunsetTimeEl = document.getElementById('sunsetTime');
const moonriseTimeEl = document.getElementById('moonriseTime');
const moonsetTimeEl = document.getElementById('moonsetTime');
const moonPhaseEl = document.getElementById('moonPhase');
const tidesTitleEl = document.getElementById('tidesTitle');
const nextTideEl = document.getElementById('nextTide');
const tideListEl = document.getElementById('tideList');
const windSummaryEl = document.getElementById('windSummary');
const windChartEl = document.getElementById('windChart');
const temperatureChartEl = document.getElementById('temperatureChart');
const precipitationChartEl = document.getElementById('precipitationChart');
const LAST_DAY_KEY = 'azores-beach-selected-day';
const UNIT_SYSTEM_KEY = 'azores-beach-unit-system';
const LOCATION_OPTIONS = [LOCATION];

let weatherPayload = null;
let marinePayload = null;
let mergedHourly = [];
let dayKeys = [];
let selectedDayKey = '';
let unitSystem = UNIT_SYSTEMS.imperial;

init();

function init() {
  addVersionTag();
  renderLocationSelect();
  restoreSelectedDay();
  restoreUnitSystem();
  bindUnitToggle();
  renderUnitToggle();
  daySelectorEl.addEventListener('click', handleDayClick);
  loadLocation();
}

function addVersionTag() {
  const title = document.querySelector('.header h1');
  if (!title) return;

  const version = document.createElement('span');
  version.textContent = ` ${APP_VERSION}`;
  version.style.fontSize = '0.76rem';
  version.style.fontWeight = '600';
  version.style.color = '#486581';
  version.style.verticalAlign = 'middle';
  title.appendChild(version);
}

function renderLocationSelect() {
  locationSelectEl.innerHTML = '';

  LOCATION_OPTIONS.forEach(location => {
    const option = document.createElement('option');
    option.value = location.id;
    option.textContent = `${location.displayName} · ${location.subtitle}`;
    locationSelectEl.appendChild(option);
  });

  locationSelectEl.value = LOCATION.id;
}

function restoreSelectedDay() {
  selectedDayKey = localStorage.getItem(LAST_DAY_KEY) || '';
}

function restoreUnitSystem() {
  const saved = localStorage.getItem(UNIT_SYSTEM_KEY);
  unitSystem = saved === UNIT_SYSTEMS.metric ? UNIT_SYSTEMS.metric : UNIT_SYSTEMS.imperial;
}

function bindUnitToggle() {
  metricButtonEl?.addEventListener('click', () => setUnitSystem(UNIT_SYSTEMS.metric));
  imperialButtonEl?.addEventListener('click', () => setUnitSystem(UNIT_SYSTEMS.imperial));
}

function setUnitSystem(nextSystem) {
  if (!Object.values(UNIT_SYSTEMS).includes(nextSystem)) return;
  if (unitSystem === nextSystem) return;

  unitSystem = nextSystem;
  localStorage.setItem(UNIT_SYSTEM_KEY, unitSystem);
  renderUnitToggle();

  if (dayKeys.length) {
    renderSelectedDay();
  }
}

function renderUnitToggle() {
  metricButtonEl?.classList.toggle('is-active', unitSystem === UNIT_SYSTEMS.metric);
  imperialButtonEl?.classList.toggle('is-active', unitSystem === UNIT_SYSTEMS.imperial);
  metricButtonEl?.setAttribute('aria-pressed', String(unitSystem === UNIT_SYSTEMS.metric));
  imperialButtonEl?.setAttribute('aria-pressed', String(unitSystem === UNIT_SYSTEMS.imperial));
}

function handleDayClick(event) {
  const button = event.target.closest('.day-button');
  if (!button) return;

  selectedDayKey = button.dataset.dateKey;
  localStorage.setItem(LAST_DAY_KEY, selectedDayKey);
  renderDaySelector();
  renderSelectedDay();
}

async function loadLocation() {
  statusEl.textContent = `Loading ${LOCATION.displayName}…`;

  try {
    const [weather, marine] = await Promise.all([
      fetchWeather(),
      fetchMarine()
    ]);

    weatherPayload = weather;
    marinePayload = marine;
    mergedHourly = mergeHourlyData(weatherPayload, marinePayload);
    dayKeys = getDayKeys(weatherPayload);

    if (!dayKeys.length) {
      throw new Error('No forecast days returned.');
    }

    if (!dayKeys.includes(selectedDayKey)) {
      selectedDayKey = getCurrentDateKey();
    }
    if (!dayKeys.includes(selectedDayKey)) {
      selectedDayKey = dayKeys[0];
    }

    localStorage.setItem(LAST_DAY_KEY, selectedDayKey);
    renderDaySelector();
    renderSelectedDay();
    statusEl.textContent = `${LOCATION.displayName} updated.`;
  } catch (error) {
    console.error(error);
    statusEl.textContent = 'Azores forecast failed to load. Try refresh.';
    notesListEl.innerHTML = '<li>Forecast unavailable right now.</li>';
  }
}

async function fetchWeather() {
  const params = new URLSearchParams({
    latitude: String(LOCATION.lat),
    longitude: String(LOCATION.lon),
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'dew_point_2m',
      'precipitation_probability',
      'visibility',
      'wind_speed_10m',
      'wind_direction_10m'
    ].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min'
    ].join(','),
    forecast_days: '7',
    timezone: LOCATION.timezone,
    wind_speed_unit: 'kmh'
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error('Open-Meteo weather request failed.');
  return response.json();
}

async function fetchMarine() {
  const params = new URLSearchParams({
    latitude: String(LOCATION.lat),
    longitude: String(LOCATION.lon),
    hourly: [
      'wave_height',
      'wave_direction',
      'wave_period',
      'sea_surface_temperature',
      'sea_level_height_msl'
    ].join(','),
    forecast_days: '7',
    timezone: LOCATION.timezone
  });

  const response = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params.toString()}`);
  if (!response.ok) throw new Error('Open-Meteo marine request failed.');
  return response.json();
}

function mergeHourlyData(weather, marine) {
  const map = new Map();

  const weatherTimes = weather?.hourly?.time || [];
  weatherTimes.forEach((time, index) => {
    map.set(time, {
      time,
      dayKey: getDayKeyFromIso(time),
      hour: getHourFromIso(time),
      temperature: getIndexedValue(weather.hourly.temperature_2m, index),
      apparentTemperature: getIndexedValue(weather.hourly.apparent_temperature, index),
      dewPoint: getIndexedValue(weather.hourly.dew_point_2m, index),
      precipitationProbability: getIndexedValue(weather.hourly.precipitation_probability, index),
      visibility: getIndexedValue(weather.hourly.visibility, index),
      windSpeed: getIndexedValue(weather.hourly.wind_speed_10m, index),
      windDirectionDeg: getIndexedValue(weather.hourly.wind_direction_10m, index)
    });
  });

  const marineTimes = marine?.hourly?.time || [];
  marineTimes.forEach((time, index) => {
    const entry = map.get(time) || {
      time,
      dayKey: getDayKeyFromIso(time),
      hour: getHourFromIso(time)
    };

    entry.waveHeight = getIndexedValue(marine.hourly.wave_height, index);
    entry.waveDirectionDeg = getIndexedValue(marine.hourly.wave_direction, index);
    entry.wavePeriod = getIndexedValue(marine.hourly.wave_period, index);
    entry.seaTemp = getIndexedValue(marine.hourly.sea_surface_temperature, index);
    entry.seaLevelHeight = getIndexedValue(marine.hourly.sea_level_height_msl, index);
    map.set(time, entry);
  });

  return [...map.values()].sort((a, b) => a.time.localeCompare(b.time));
}

function getIndexedValue(values, index) {
  const value = values?.[index];
  return Number.isFinite(value) ? value : null;
}

function getDayKeys(weather) {
  return Array.isArray(weather?.daily?.time) ? weather.daily.time.slice(0, 7) : [];
}

function renderDaySelector() {
  daySelectorEl.innerHTML = dayKeys.map((dayKey, index) => {
    const label = dayKey === getCurrentDateKey() ? 'Today' : formatWeekday(dayKey);
    const selected = dayKey === selectedDayKey;

    return `
      <button class="day-button${selected ? ' is-selected' : ''}" type="button" data-date-key="${dayKey}" aria-pressed="${selected}">
        <strong>${label}</strong>
        <span>${formatShortDate(dayKey)}</span>
      </button>
    `;
  }).join('');
}

function renderSelectedDay() {
  const dailyWeather = getDailyWeather(selectedDayKey);
  const dayHours = getDayHours(selectedDayKey);
  const daytimeHours = getDaytimeHours(dayHours);
  const summaryHour = getSummaryHour(dayHours, selectedDayKey);
  const seaHour = getSeaSummaryHour(dayHours, selectedDayKey);
  const astronomy = calculateAstronomy(selectedDayKey);

  renderWeather(summaryHour, dailyWeather, selectedDayKey);
  renderSeaState(seaHour);
  renderAstronomy(astronomy);
  renderTides(dayHours, selectedDayKey);
  renderNotes(buildNotes(dayHours, daytimeHours, selectedDayKey));
  renderWind(daytimeHours, selectedDayKey);
  renderTemperature(daytimeHours, selectedDayKey);
  renderPrecipitation(daytimeHours, selectedDayKey);
}

function getDailyWeather(dayKey) {
  const index = weatherPayload?.daily?.time?.indexOf(dayKey) ?? -1;
  if (index < 0) return null;

  return {
    maxTemp: getIndexedValue(weatherPayload.daily.temperature_2m_max, index),
    minTemp: getIndexedValue(weatherPayload.daily.temperature_2m_min, index),
    maxApparentTemp: getIndexedValue(weatherPayload.daily.apparent_temperature_max, index),
    minApparentTemp: getIndexedValue(weatherPayload.daily.apparent_temperature_min, index)
  };
}

function getDayHours(dayKey) {
  return mergedHourly.filter(entry => entry.dayKey === dayKey);
}

function getDaytimeHours(hours) {
  return hours.filter(entry => entry.hour >= 6 && entry.hour < 18);
}

function getSummaryHour(hours, dayKey) {
  if (!hours.length) return null;

  if (dayKey === getCurrentDateKey()) {
    const nowHour = getCurrentHourFraction();
    return hours.find(entry => entry.hour >= Math.floor(nowHour)) || hours[0];
  }

  return getNearestHour(hours, 12);
}

function getSeaSummaryHour(hours, dayKey) {
  const candidates = hours.filter(entry => hasSeaState(entry));
  if (!candidates.length) return null;

  if (dayKey === getCurrentDateKey()) {
    const nowHour = getCurrentHourFraction();
    return candidates.find(entry => entry.hour >= Math.floor(nowHour)) || candidates[0];
  }

  return getNearestHour(candidates, 12);
}

function getNearestHour(hours, targetHour) {
  return hours.reduce((closest, entry) => {
    if (!closest) return entry;
    return Math.abs(entry.hour - targetHour) < Math.abs(closest.hour - targetHour) ? entry : closest;
  }, null);
}

function renderWeather(summaryHour, dailyWeather, dayKey) {
  if (!summaryHour && !dailyWeather) {
    airTempEl.textContent = '--';
    windEl.textContent = '--';
    weatherFeelsEl.textContent = '';
    weatherRangeEl.textContent = '';
    weatherUpdatedEl.textContent = 'No weather data for this day.';
    return;
  }

  const isToday = dayKey === getCurrentDateKey();

  if (isToday && summaryHour) {
    weatherCardTitleEl.textContent = 'Now';
    airLabelEl.textContent = 'Air';
    windLabelEl.textContent = 'Wind';
    airTempEl.textContent = formatTemperature(summaryHour.temperature);
    windEl.textContent = formatWind(summaryHour.windSpeed, summaryHour.windDirectionDeg);
    weatherFeelsEl.textContent = getFeelsText(summaryHour);
    weatherRangeEl.textContent = dailyWeather
      ? `Daytime range: ${formatTemperature(dailyWeather.minTemp)} to ${formatTemperature(dailyWeather.maxTemp)}`
      : '';
    weatherUpdatedEl.textContent = `Forecast hour: ${formatHour(summaryHour.time)}`;
    return;
  }

  weatherCardTitleEl.textContent = 'Daytime';
  airLabelEl.textContent = 'High';
  windLabelEl.textContent = 'Low';
  airTempEl.textContent = formatTemperature(dailyWeather?.maxTemp);
  windEl.textContent = formatTemperature(dailyWeather?.minTemp);
  weatherFeelsEl.textContent = dailyWeather && Number.isFinite(dailyWeather.maxApparentTemp)
    ? `Feels like: ${formatTemperature(dailyWeather.maxApparentTemp)} max`
    : '';
  weatherRangeEl.textContent = summaryHour && Number.isFinite(summaryHour.windSpeed)
    ? `Representative wind: ${formatWind(summaryHour.windSpeed, summaryHour.windDirectionDeg)}`
    : '';
  weatherUpdatedEl.textContent = summaryHour ? `Representative hour: ${formatHour(summaryHour.time)}` : '';
}

function renderSeaState(summaryHour) {
  waveHeightEl.textContent = formatWaveHeight(summaryHour?.waveHeight);
  wavePeriodEl.textContent = formatWavePeriod(summaryHour?.wavePeriod);
  waveDirectionEl.textContent = formatDirection(summaryHour?.waveDirectionDeg) || '--';
  seaTempEl.textContent = formatTemperature(summaryHour?.seaTemp);
  seaUpdatedEl.textContent = summaryHour ? `Representative hour: ${formatHour(summaryHour.time)}` : 'Sea-state data unavailable.';
}

function renderTides(dayHours, dayKey) {
  tidesTitleEl.textContent = dayKey === getCurrentDateKey()
    ? 'Tide Outlook Today'
    : `Tide Outlook ${formatShortDate(dayKey)}`;

  const turningPoints = getTideTurningPoints(dayHours);
  tideListEl.innerHTML = '';

  if (!turningPoints.length) {
    nextTideEl.textContent = 'Model tide signal unavailable.';
    tideListEl.innerHTML = '<div class="tide-item">No tide turning points available for this day.</div>';
    return;
  }

  const nextPoint = getNextTidePoint(turningPoints, dayKey);
  nextTideEl.textContent = `${dayKey === getCurrentDateKey() ? 'Next tide' : 'First tide'}: ${tideLabel(nextPoint.type)} at ${formatHour(nextPoint.time)}`;
  tideListEl.innerHTML = turningPoints.map(point => `
    <div class="tide-item">
      <span class="tide-type ${point.type === 'H' ? 'high' : 'low'}">${tideLabel(point.type)}</span>
      <span>${formatHour(point.time)} · ${formatTideHeight(point.height)}</span>
    </div>
  `).join('');
}

function buildWhaleWatchingNote(dayHours, daytimeHours, dayKey) {
  const morningHours = getWhaleWatchingHours(dayHours, daytimeHours, dayKey);
  const afternoonHours = daytimeHours.filter(entry => entry.hour >= 13 && entry.hour < 18);

  if (!morningHours.length) {
    return 'Whale watching outlook unavailable right now.';
  }

  const month = getDateFromDayKey(dayKey).getUTCMonth();
  const morningEvaluation = evaluateWhaleWatchingWindow(morningHours, month);
  const afternoonEvaluation = afternoonHours.length
    ? evaluateWhaleWatchingWindow(afternoonHours, month)
    : null;
  const conditionCutoff = getWhaleWatchingConditionCutoff(daytimeHours, morningHours);

  if (
    conditionCutoff
    && morningEvaluation.finalLevel >= 2
  ) {
    return formatTimeWindowWhaleWatchingSentence(
      morningEvaluation.finalLevel,
      month,
      `before ${formatCompactHour(conditionCutoff.hour)}`,
      conditionCutoff.reason
    );
  }

  if (
    afternoonEvaluation
    && morningEvaluation.finalLevel >= 2
    && morningEvaluation.finalLevel > afternoonEvaluation.finalLevel
  ) {
    return formatTimeWindowWhaleWatchingSentence(morningEvaluation.finalLevel, month, 'before midday');
  }

  return formatWhaleWatchingSentence(
    morningEvaluation.finalLevel,
    morningEvaluation.seasonType,
    morningEvaluation.reason
  );
}

function buildNotes(dayHours, daytimeHours, dayKey) {
  const notes = [];
  const maxPrecip = getMaxBy(daytimeHours, 'precipitationProbability');
  const peakWind = getPeakWind(daytimeHours);
  const maxWave = getMaxWave(dayHours);
  const seaWindow = getCalmSeaWindow(daytimeHours);
  const whaleWatchingNote = buildWhaleWatchingNote(dayHours, daytimeHours, dayKey);
  const ferrariaNote = buildFerrariaNote(dayHours, daytimeHours, dayKey);

  if (maxPrecip && maxPrecip.precipitationProbability >= 60) {
    notes.push({ priority: 1, text: `Rain most likely around ${formatHour(maxPrecip.time)}.` });
  } else if (maxPrecip && maxPrecip.precipitationProbability >= 35) {
    notes.push({ priority: 3, text: 'Passing showers are possible during the day.' });
  }

  if (peakWind && peakWind.windSpeed >= 35) {
    notes.push({ priority: 2, text: `Windy stretch near ${formatHour(peakWind.time)} with gustier beach feel.` });
  } else if (peakWind && peakWind.windSpeed >= 24) {
    notes.push({ priority: 4, text: 'Breezy through the daytime window.' });
  }

  if (maxWave && maxWave.waveHeight >= 2.2) {
    notes.push({ priority: 2, text: 'Rougher sea state expected, especially on open south-facing shores.' });
  } else if (maxWave && maxWave.waveHeight >= 1.4) {
    notes.push({ priority: 4, text: 'Moderate surf most of the day.' });
  }

  if (seaWindow) {
    notes.push({ priority: 5, text: `Calmer sea window around ${formatHour(seaWindow.time)}.` });
  }

  if (whaleWatchingNote) {
    notes.push({ priority: 3, text: whaleWatchingNote });
  }

  if (ferrariaNote) {
    notes.push({ priority: 3, text: ferrariaNote });
  }

  if (!notes.length) {
    notes.push({
      priority: 6,
      text: dayKey === getCurrentDateKey()
        ? 'No major weather or sea-state swings in the daytime window.'
        : 'Conditions look fairly steady for the selected day.'
    });
  }

  return notes.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

function renderNotes(notes) {
  notesListEl.innerHTML = notes.map(note => `<li>${note.text}</li>`).join('');
}

function getMaxBy(entries, key) {
  return entries.reduce((best, entry) => {
    if (!Number.isFinite(entry?.[key])) return best;
    if (!best || entry[key] > best[key]) return entry;
    return best;
  }, null);
}

function getPeakWind(entries) {
  return getMaxBy(entries, 'windSpeed');
}

function getMaxWave(entries) {
  return getMaxBy(entries.filter(hasSeaState), 'waveHeight');
}

function getCalmSeaWindow(entries) {
  const calmCandidates = entries.filter(entry =>
    Number.isFinite(entry.waveHeight)
    && Number.isFinite(entry.windSpeed)
    && entry.waveHeight <= 1.1
    && entry.windSpeed <= 18
  );

  return getNearestHour(calmCandidates, 9);
}

function buildFerrariaNote(dayHours, daytimeHours, dayKey) {
  const lowTidePoint = getPreferredFerrariaLowTide(dayHours, dayKey);
  if (!lowTidePoint) return null;

  const baseWindow = getFerrariaBaseWindow(lowTidePoint);
  const adjustedWindow = adjustFerrariaWindow(baseWindow, daytimeHours, lowTidePoint);
  const windowEntries = getEntriesInHourWindow(dayHours, adjustedWindow.startHour, adjustedWindow.endHour);
  if (!windowEntries.length) return null;

  const level = evaluateFerrariaCondition(windowEntries);
  const labels = ['Poor', 'Fair', 'Good', 'Excellent'];
  const lowTideText = formatHour(lowTidePoint.time);
  const windowText = formatHourRange(adjustedWindow.startHour, adjustedWindow.endHour);

  if (level === 0) {
    return 'Poor Ferraria conditions due to rough Atlantic surge.';
  }

  if (level === 1) {
    return `Fair Ferraria conditions despite favorable ${lowTideText.toLowerCase()} low tide timing.`;
  }

  if (adjustedWindow.isNarrow) {
    return `${labels[level]} Ferraria conditions near the ${lowTideText.toLowerCase()} low tide.`;
  }

  return `${labels[level]} Ferraria conditions from ${windowText} near low tide.`;
}

function getWhaleWatchingHours(dayHours, daytimeHours, dayKey) {
  const morningHours = dayHours.filter(entry => entry.hour >= 6 && entry.hour < 13);
  if (dayKey !== getCurrentDateKey() && morningHours.length) {
    return morningHours;
  }

  if (dayKey === getCurrentDateKey()) {
    const nowHour = getCurrentHourFraction();
    const remainingMorning = morningHours.filter(entry => entry.hour >= Math.floor(nowHour));
    if (remainingMorning.length) {
      return remainingMorning;
    }

    const remainingDaytime = daytimeHours.filter(entry => entry.hour >= Math.floor(nowHour));
    if (remainingDaytime.length) {
      return remainingDaytime;
    }
  }

  return morningHours.length ? morningHours : daytimeHours;
}

function getPreferredFerrariaLowTide(dayHours, dayKey) {
  const lowTides = getTideTurningPoints(dayHours)
    .filter(point => point.type === 'L')
    .filter(point => {
      const hour = getHourFromIso(point.time);
      return hour >= 6 && hour <= 18;
    });

  if (!lowTides.length) {
    return getTideTurningPoints(dayHours).find(point => point.type === 'L') || null;
  }

  if (dayKey === getCurrentDateKey()) {
    const nowHour = getCurrentHourFraction();
    const upcoming = lowTides.find(point => getHourFromIso(point.time) + 1 >= nowHour);
    if (upcoming) return upcoming;
  }

  return getNearestPointToHour(lowTides, 11) || lowTides[0];
}

function getNearestPointToHour(points, targetHour) {
  return points.reduce((closest, point) => {
    if (!closest) return point;
    const pointHour = getHourFromIso(point.time);
    const closestHour = getHourFromIso(closest.time);
    return Math.abs(pointHour - targetHour) < Math.abs(closestHour - targetHour) ? point : closest;
  }, null);
}

function getFerrariaBaseWindow(lowTidePoint) {
  const lowHour = getHourFromIso(lowTidePoint.time);
  return {
    lowHour,
    startHour: Math.max(6, lowHour - 2),
    endHour: Math.min(18, lowHour + 1)
  };
}

function adjustFerrariaWindow(baseWindow, daytimeHours, lowTidePoint) {
  const postLowEntries = daytimeHours.filter(entry => entry.hour > baseWindow.lowHour && entry.hour <= baseWindow.lowHour + 2);
  const preLowEntries = daytimeHours.filter(entry => entry.hour >= baseWindow.startHour && entry.hour <= baseWindow.lowHour);
  const lowTideEntry = daytimeHours.find(entry => entry.hour === baseWindow.lowHour) || null;
  let startHour = baseWindow.startHour;
  let endHour = baseWindow.endHour;

  const worseningWind = getFirstEntryMatching(postLowEntries, entry => toDisplayWindSpeed(entry.windSpeed) >= 17);
  const worseningSwell = getFirstEntryMatching(postLowEntries, entry => {
    if (!Number.isFinite(entry.waveHeight)) return false;
    const baseline = Number.isFinite(lowTideEntry?.waveHeight)
      ? lowTideEntry.waveHeight
      : getMaxBy(preLowEntries, 'waveHeight')?.waveHeight;
    return Number.isFinite(baseline) && entry.waveHeight >= baseline + 0.5;
  });

  if (worseningWind || worseningSwell) {
    endHour = Math.max(baseWindow.lowHour, Math.min(
      endHour,
      (worseningWind ? worseningWind.hour : Infinity),
      (worseningSwell ? worseningSwell.hour : Infinity)
    ) - 1);
  }

  const earlyWindWorsening = getFirstEntryMatching(preLowEntries, entry =>
    entry.hour >= baseWindow.lowHour - 1 && toDisplayWindSpeed(entry.windSpeed) >= 17
  );
  if (earlyWindWorsening) {
    endHour = Math.min(endHour, baseWindow.lowHour);
  }

  const improvingAfterLowTide = postLowEntries.length
    && postLowEntries.every(entry =>
      (!Number.isFinite(entry.waveHeight) || !Number.isFinite(lowTideEntry?.waveHeight) || entry.waveHeight <= lowTideEntry.waveHeight)
      && toDisplayWindSpeed(entry.windSpeed) < 17
    );

  if (improvingAfterLowTide) {
    endHour = Math.min(18, Math.max(endHour, baseWindow.lowHour + 2));
  }

  if (toDisplayWindSpeed(getPeakWind(preLowEntries)?.windSpeed) >= 22) {
    startHour = Math.max(6, startHour - 1);
    endHour = Math.min(endHour, baseWindow.lowHour);
  }

  return {
    startHour,
    endHour,
    isNarrow: endHour - startHour <= 1
  };
}

function getFirstEntryMatching(entries, predicate) {
  return entries.find(entry => {
    try {
      return predicate(entry);
    } catch (error) {
      return false;
    }
  }) || null;
}

function getEntriesInHourWindow(entries, startHour, endHour) {
  return entries.filter(entry => entry.hour >= startHour && entry.hour <= endHour);
}

function evaluateFerrariaCondition(entries) {
  const maxWave = getMaxBy(entries.filter(entry => Number.isFinite(entry.waveHeight)), 'waveHeight')?.waveHeight;
  const peakWindMph = toDisplayWindSpeed(getPeakWind(entries)?.windSpeed);

  if (Number.isFinite(maxWave)) {
    if (maxWave > 4) return 0;
    if (maxWave > 2.5) return 1;
    if (maxWave >= 1.5) return 2;
  }

  if (Number.isFinite(peakWindMph)) {
    if (peakWindMph > 22) return 0;
    if (peakWindMph >= 17) return 1;
    if (peakWindMph >= 10) return 2;
  }

  return 3;
}

function getWhaleSeasonType(monthIndex) {
  if (monthIndex >= 3 && monthIndex <= 5) return 'peak';
  if (monthIndex >= 6 && monthIndex <= 9) return 'active';
  return 'reduced';
}

function evaluateWhaleWatchingWindow(entries, monthIndex) {
  const swellLevel = getSwellLevel(getMaxBy(entries.filter(entry => Number.isFinite(entry.waveHeight)), 'waveHeight')?.waveHeight);
  const windDirectionEntry = getRepresentativeWindDirectionEntry(entries);
  const directionModifier = getWindDirectionModifier(windDirectionEntry?.windDirectionDeg);
  const windSpeedLevel = getWindSpeedLevel(getPeakWind(entries)?.windSpeed);
  const visibilityLevelModifier = getVisibilityModifier(getBestVisibility(entries));
  const rainModifier = getRainModifier(getMaxBy(entries, 'precipitationProbability')?.precipitationProbability);

  const baseLevels = [swellLevel, windSpeedLevel].filter(value => value !== null);
  let marineLevel = baseLevels.length ? Math.min(...baseLevels) : 2;
  marineLevel = clampConditionLevel(marineLevel + directionModifier);

  let finalLevel = marineLevel;
  if (visibilityLevelModifier > 0) {
    finalLevel = Math.min(finalLevel + 1, 2);
  } else if (visibilityLevelModifier < 0) {
    finalLevel -= 1;
  }
  finalLevel += rainModifier;
  finalLevel = applySeasonModifier(finalLevel, marineLevel, monthIndex, {
    swellLevel,
    windSpeedLevel,
    directionModifier
  });
  finalLevel = applySwellCap(finalLevel, swellLevel);

  return {
    finalLevel,
    seasonType: getWhaleSeasonType(monthIndex),
    reason: getWhaleWatchingReason({
      swellLevel,
      windDirectionDeg: windDirectionEntry?.windDirectionDeg,
      windSpeedLevel,
      visibilityModifier: visibilityLevelModifier,
      rainModifier,
      finalLevel
    })
  };
}

function getWhaleWatchingWindCutoffHour(entries) {
  const thresholdMph = 17;

  for (const entry of entries) {
    if (!Number.isFinite(entry?.windSpeed)) continue;
    const speedMph = entry.windSpeed * 0.621371;
    if (speedMph >= thresholdMph) {
      return entry.hour;
    }
  }

  return null;
}

function getWhaleWatchingConditionCutoff(daytimeHours, morningHours) {
  const thresholdMph = 17;
  const baselineWave = getMaxBy(morningHours.filter(entry => Number.isFinite(entry.waveHeight)), 'waveHeight')?.waveHeight ?? null;

  for (const entry of daytimeHours) {
    if (entry.hour < 12) continue;

    const speedMph = toDisplayWindSpeed(entry.windSpeed);
    if (Number.isFinite(speedMph) && speedMph >= thresholdMph) {
      return { hour: entry.hour, reason: 'winds build later' };
    }

    if (Number.isFinite(entry.precipitationProbability) && entry.precipitationProbability > 70) {
      return { hour: entry.hour, reason: 'rain builds later' };
    }

    if (Number.isFinite(entry.waveHeight)) {
      if (entry.waveHeight > 2.5) {
        return { hour: entry.hour, reason: 'seas build later' };
      }

      if (Number.isFinite(baselineWave) && entry.waveHeight >= baselineWave + 0.5) {
        return { hour: entry.hour, reason: 'seas build later' };
      }
    }
  }

  return null;
}

function getSwellLevel(value) {
  if (!Number.isFinite(value)) return null;
  if (value < 1.5) return 3;
  if (value <= 2.5) return 2;
  if (value <= 4) return 1;
  return 0;
}

function getWindSpeedLevel(value) {
  if (!Number.isFinite(value)) return null;
  const speedMph = value * 0.621371;
  if (speedMph < 10) return 3;
  if (speedMph <= 16) return 2;
  if (speedMph <= 22) return 1;
  return 0;
}

function getWindDirectionModifier(directionDeg) {
  if (!Number.isFinite(directionDeg)) return 0;

  const direction = formatDirection(directionDeg);
  if (['N', 'NE', 'E'].includes(direction)) return 1;
  if (['NW', 'SE'].includes(direction)) return 0;
  if (['S', 'SW', 'W'].includes(direction)) return -1;
  return 0;
}

function getVisibilityModifier(entry) {
  const visibilityKm = getVisibilityKm(entry?.visibility);
  if (!Number.isFinite(visibilityKm)) return 0;
  if (visibilityKm > 10) return 1;
  if (visibilityKm < 5) return -1;
  return 0;
}

function getRainModifier(value) {
  return Number.isFinite(value) && value > 70 ? -1 : 0;
}

function getVisibilityKm(value) {
  if (!Number.isFinite(value)) return null;
  return value / 1000;
}

function getBestVisibility(entries) {
  return entries.reduce((best, entry) => {
    if (!Number.isFinite(entry?.visibility)) return best;
    if (!best || entry.visibility > best.visibility) return entry;
    return best;
  }, null);
}

function getRepresentativeWindDirectionEntry(entries) {
  const preferred = getNearestHour(entries.filter(entry => Number.isFinite(entry.windDirectionDeg)), 9);
  return preferred || entries.find(entry => Number.isFinite(entry.windDirectionDeg)) || null;
}

function applySeasonModifier(level, marineLevel, monthIndex, context = {}) {
  const season = getWhaleSeasonType(monthIndex);

  if (
    season === 'peak'
    && marineLevel >= 2
    && context.swellLevel === 3
    && context.windSpeedLevel === 3
    && context.directionModifier >= 0
  ) {
    return clampConditionLevel(level + 1);
  }

  if (season === 'reduced' && marineLevel < 3) {
    return clampConditionLevel(level - 1);
  }

  return clampConditionLevel(level);
}

function applySwellCap(level, swellLevel) {
  if (swellLevel === null) {
    return clampConditionLevel(level);
  }

  return clampConditionLevel(Math.min(level, swellLevel));
}

function clampConditionLevel(value) {
  return Math.max(0, Math.min(3, value));
}

function getWhaleWatchingReason({ swellLevel, windDirectionDeg, windSpeedLevel, visibilityModifier, rainModifier, finalLevel }) {
  const direction = formatDirection(windDirectionDeg);

  if (swellLevel === 0) return 'rough Atlantic swell';
  if (visibilityModifier < 0) return 'limited visibility';
  if (rainModifier < 0) return 'showery visibility';
  if (['S', 'SW', 'W'].includes(direction)) return 'choppier south coast seas';
  if (swellLevel === 1) return 'mixed Atlantic swell';
  if (windSpeedLevel === 0) return 'windy south coast seas';
  if (finalLevel >= 2 && ['N', 'NE', 'E'].includes(direction)) return 'smoother south coast seas';
  if (finalLevel === 3) return 'calmer Atlantic seas';
  return '';
}

function formatWhaleWatchingSentence(level, seasonType, reason) {
  const labels = ['Poor', 'Fair', 'Good', 'Excellent'];
  const lead = `${labels[level]} whale watching conditions`;

  if (level === 0 && reason) {
    return `${lead} with ${reason}.`;
  }

  if (seasonType === 'peak') {
    if (level === 3) return `${lead} during peak whale season.`;
    if (level >= 2) return `${lead} with strong seasonal activity.`;
    return `${lead} despite peak whale season.`;
  }

  if (seasonType === 'reduced') {
    if (reason) return `${lead} with ${reason} and reduced seasonal activity.`;
    return `${lead} with reduced seasonal activity.`;
  }

  if (reason) {
    return `${lead} with ${reason}.`;
  }

  if (seasonType === 'active' && level >= 2) {
    return `${lead} during active whale season.`;
  }

  return `${lead}.`;
}

function formatTimeWindowWhaleWatchingSentence(level, monthIndex, windowText, reason = '') {
  const labels = ['Poor', 'Fair', 'Good', 'Excellent'];
  const seasonType = getWhaleSeasonType(monthIndex);
  const lead = `${labels[level]} whale watching conditions ${windowText}`;

  if (seasonType === 'peak') {
    if (reason) {
      if (level === 3) return `${lead} as ${reason} during peak whale season.`;
      return `${lead} as ${reason} with strong seasonal activity.`;
    }
    if (level === 3) return `${lead} during peak whale season.`;
    return `${lead} with strong seasonal activity.`;
  }

  if (seasonType === 'reduced') {
    if (reason) return `${lead} as ${reason} with reduced seasonal activity.`;
    return `${lead} with reduced seasonal activity.`;
  }

  if (reason) return `${lead} as ${reason}.`;
  return `${lead}.`;
}

function getTideTurningPoints(entries) {
  const candidates = entries.filter(entry => Number.isFinite(entry?.seaLevelHeight));
  if (candidates.length < 3) return [];

  const points = [];

  for (let index = 1; index < candidates.length - 1; index += 1) {
    const previous = candidates[index - 1].seaLevelHeight;
    const current = candidates[index].seaLevelHeight;
    const next = candidates[index + 1].seaLevelHeight;
    const isHigh = current >= previous && current > next;
    const isLow = current <= previous && current < next;

    if (!isHigh && !isLow) continue;

    points.push({
      type: isHigh ? 'H' : 'L',
      time: candidates[index].time,
      height: current
    });
  }

  return dedupeAdjacentTidePoints(points);
}

function dedupeAdjacentTidePoints(points) {
  return points.filter((point, index) => {
    if (index === 0) return true;
    return point.type !== points[index - 1].type;
  });
}

function getNextTidePoint(points, dayKey) {
  if (dayKey !== getCurrentDateKey()) return points[0];

  const nowHour = getCurrentHourFraction();
  return points.find(point => getHourFromIso(point.time) >= Math.floor(nowHour)) || points[points.length - 1];
}

function renderWind(entries, dayKey) {
  if (!entries.length) {
    windSummaryEl.textContent = '';
    windChartEl.textContent = 'Wind chart unavailable.';
    return;
  }

  windSummaryEl.textContent = getWindTrendSummary(entries);
  const layout = getChartLayout();
  const maxSpeed = Math.max(...entries.map(entry => entry.windSpeed || 0), 10);
  const displayMaxSpeed = toDisplayWindSpeed(maxSpeed);
  const chartMax = getRoundedChartMax(displayMaxSpeed, getWindStep());
  const yFromDisplay = value => layout.pad.top + layout.innerHeight - (value / chartMax) * layout.innerHeight;
  const y = value => yFromDisplay(toDisplayWindSpeed(value));
  const yLabels = [0, Math.round(chartMax / 2), chartMax];
  const barWidth = layout.barWidth;
  const peakWind = getPeakWind(entries);

  const yGrid = yLabels.map(value => `
    <line x1="${layout.pad.left}" y1="${yFromDisplay(value).toFixed(1)}" x2="${layout.width - layout.pad.right}" y2="${yFromDisplay(value).toFixed(1)}" stroke="#d9e8ef" />
    <text x="${layout.pad.left - 10}" y="${(yFromDisplay(value) + 4).toFixed(1)}" text-anchor="end" font-size="${layout.fontSmall}" fill="#486581">${value}</text>
  `).join('');
  const yAxis = `<line x1="${layout.pad.left}" y1="${layout.pad.top}" x2="${layout.pad.left}" y2="${layout.height - layout.pad.bottom}" stroke="#aac4d3" stroke-width="1.4" />`;

  const bars = entries.map(entry => {
    const centerX = layout.getSlotCenter(entry.hour);
    const x = centerX - barWidth / 2;
    const top = y(entry.windSpeed || 0);
    const barHeight = layout.pad.top + layout.innerHeight - top;
    const highlight = peakWind && entry.time === peakWind.time;

    return `
      <g>
        <title>${formatHour(entry.time)} · ${formatWind(entry.windSpeed, entry.windDirectionDeg)}</title>
        <rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="4" fill="${highlight ? '#1e5f74' : '#62a8bc'}" />
        ${Number.isFinite(entry.windDirectionDeg) ? renderArrow(centerX, top - 12, entry.windDirectionDeg) : ''}
      </g>
    `;
  }).join('');

  windChartEl.innerHTML = `
    <svg viewBox="0 0 ${layout.width} ${layout.height}" style="width:100%;height:auto;display:block;" role="img" aria-label="Daytime wind chart for ${LOCATION.displayName} on ${formatLongDate(dayKey)}.">
      ${yAxis}
      ${yGrid}
      ${renderNowLine(layout, dayKey)}
      ${bars}
      ${renderTimeLabels(layout)}
    </svg>
  `;
}

function renderTemperature(entries, dayKey) {
  const numeric = entries.filter(entry => Number.isFinite(entry.temperature));
  if (!numeric.length) {
    temperatureChartEl.textContent = 'Temperature chart unavailable.';
    return;
  }

  const layout = getChartLayout();
  const minTemp = Math.min(...numeric.map(entry => entry.temperature));
  const maxTemp = Math.max(...numeric.map(entry => entry.temperature));
  const minDisplayTemp = toDisplayTemperature(minTemp);
  const maxDisplayTemp = toDisplayTemperature(maxTemp);
  const spread = Math.max(getTemperatureSpreadFloor(), maxDisplayTemp - minDisplayTemp);
  const chartMin = Math.floor((minDisplayTemp - spread * 0.15) / 2) * 2;
  const chartMax = Math.ceil((maxDisplayTemp + spread * 0.15) / 2) * 2;
  const yFromDisplay = value => layout.pad.top + layout.innerHeight - ((value - chartMin) / Math.max(1, chartMax - chartMin)) * layout.innerHeight;
  const y = value => yFromDisplay(toDisplayTemperature(value));
  const yLabels = [chartMin, Math.round((chartMin + chartMax) / 2), chartMax];
  const path = numeric.map((entry, index) => `${index === 0 ? 'M' : 'L'} ${layout.getSlotCenter(entry.hour).toFixed(1)} ${y(entry.temperature).toFixed(1)}`).join(' ');
  const yGrid = yLabels.map(value => `
    <line x1="${layout.pad.left}" y1="${yFromDisplay(value).toFixed(1)}" x2="${layout.width - layout.pad.right}" y2="${yFromDisplay(value).toFixed(1)}" stroke="#d9e8ef" />
    <text x="${layout.pad.left - 10}" y="${(yFromDisplay(value) + 4).toFixed(1)}" text-anchor="end" font-size="${layout.fontSmall}" fill="#486581">${Math.round(value)}°</text>
  `).join('');
  const yAxis = `<line x1="${layout.pad.left}" y1="${layout.pad.top}" x2="${layout.pad.left}" y2="${layout.height - layout.pad.bottom}" stroke="#aac4d3" stroke-width="1.4" />`;

  const points = numeric.map(entry => `
    <g>
      <title>${formatHour(entry.time)} · ${formatTemperature(entry.temperature)}</title>
      <circle cx="${layout.getSlotCenter(entry.hour).toFixed(1)}" cy="${y(entry.temperature).toFixed(1)}" r="3" fill="#1e5f74" />
    </g>
  `).join('');

  temperatureChartEl.innerHTML = `
    <svg viewBox="0 0 ${layout.width} ${layout.height}" style="width:100%;height:auto;display:block;" role="img" aria-label="Daytime temperature chart for ${LOCATION.displayName} on ${formatLongDate(dayKey)}.">
      ${yAxis}
      ${yGrid}
      <path d="${path}" fill="none" stroke="#1e5f74" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${points}
      ${renderNowLine(layout, dayKey)}
      ${renderTimeLabels(layout)}
    </svg>
  `;
}

function renderPrecipitation(entries, dayKey) {
  const numeric = entries.filter(entry => Number.isFinite(entry.precipitationProbability));
  if (!numeric.length) {
    precipitationChartEl.textContent = 'Precipitation chart unavailable.';
    return;
  }

  const layout = getChartLayout();
  const y = value => layout.pad.top + layout.innerHeight - (value / 100) * layout.innerHeight;
  const yGrid = [0, 50, 100].map(value => `
    <line x1="${layout.pad.left}" y1="${y(value).toFixed(1)}" x2="${layout.width - layout.pad.right}" y2="${y(value).toFixed(1)}" stroke="#d9e8ef" />
    <text x="${layout.pad.left - 10}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end" font-size="${layout.fontSmall}" fill="#486581">${value}%</text>
  `).join('');
  const yAxis = `<line x1="${layout.pad.left}" y1="${layout.pad.top}" x2="${layout.pad.left}" y2="${layout.height - layout.pad.bottom}" stroke="#aac4d3" stroke-width="1.4" />`;

  const bars = numeric.map(entry => {
    const x = layout.getSlotCenter(entry.hour) - layout.barWidth / 2;
    const top = y(entry.precipitationProbability);
    const height = layout.pad.top + layout.innerHeight - top;

    return `
      <g>
        <title>${formatHour(entry.time)} · ${Math.round(entry.precipitationProbability)}%</title>
        <rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${layout.barWidth.toFixed(1)}" height="${height.toFixed(1)}" rx="4" fill="#8dc7d8" />
      </g>
    `;
  }).join('');

  precipitationChartEl.innerHTML = `
    <svg viewBox="0 0 ${layout.width} ${layout.height}" style="width:100%;height:auto;display:block;" role="img" aria-label="Daytime precipitation chart for ${LOCATION.displayName} on ${formatLongDate(dayKey)}.">
      ${yAxis}
      ${yGrid}
      ${renderNowLine(layout, dayKey)}
      ${bars}
      ${renderTimeLabels(layout)}
    </svg>
  `;
}

function getChartLayout() {
  const width = 640;
  const height = 232;
  const isPhone = window.innerWidth <= 600;
  const pad = { top: 24, right: 12, bottom: 34, left: isPhone ? 72 : 50 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const labelHours = [6, 8, 10, 12, 14, 16, 18];
  const hourSpan = 12;
  const slotWidth = innerWidth / hourSpan;

  return {
    width,
    height,
    pad,
    innerWidth,
    innerHeight,
    fontSmall: isPhone ? 20 : 14,
    barWidth: slotWidth * 0.72,
    getX(hour) {
      const progress = (hour - 6) / hourSpan;
      return pad.left + Math.max(0, Math.min(1, progress)) * innerWidth;
    },
    getSlotCenter(hour) {
      return this.getX(hour) + (slotWidth / 2);
    },
    getNowX(hourFraction) {
      if (hourFraction < 6 || hourFraction > 18) return null;
      const progress = (hourFraction - 6) / hourSpan;
      return pad.left + Math.max(0, Math.min(1, progress)) * innerWidth;
    },
    labelHours
  };
}

function renderNowLine(layout, dayKey) {
  if (dayKey !== getCurrentDateKey()) return '';

  const x = layout.getNowX(getCurrentHourFraction());
  if (x === null) return '';

  return `
    <line x1="${x.toFixed(1)}" y1="${layout.pad.top}" x2="${x.toFixed(1)}" y2="${layout.height - layout.pad.bottom}" stroke="#d64545" stroke-width="2" stroke-dasharray="5 4" />
    <text x="${Math.min(layout.width - 28, x + 6).toFixed(1)}" y="${layout.pad.top + 12}" font-size="${layout.fontSmall}" fill="#b42318">Now</text>
  `;
}

function renderTimeLabels(layout) {
  return layout.labelHours.map(hour => `
    <text x="${layout.getX(hour).toFixed(1)}" y="${layout.height - 10}" text-anchor="middle" font-size="${layout.fontSmall}" fill="#486581">${formatCompactHour(hour)}</text>
  `).join('');
}

function renderArrow(cx, cy, directionDeg) {
  const flowDeg = (directionDeg + 180) % 360;
  const shaftTop = cy - 8;
  const shaftBottom = cy + 8;
  const leftX = cx - 4;
  const rightX = cx + 4;

  return `
    <g transform="rotate(${flowDeg.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})">
      <line x1="${cx.toFixed(1)}" y1="${shaftBottom.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${shaftTop.toFixed(1)}" stroke="#102a43" stroke-width="2.2" stroke-linecap="round" />
      <path d="M ${leftX.toFixed(1)} ${(shaftTop + 4).toFixed(1)} L ${cx.toFixed(1)} ${shaftTop.toFixed(1)} L ${rightX.toFixed(1)} ${(shaftTop + 4).toFixed(1)}" fill="none" stroke="#102a43" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </g>
  `;
}

function renderAstronomy(astronomy) {
  sunriseTimeEl.textContent = formatEventTime(astronomy.sunrise);
  sunsetTimeEl.textContent = formatEventTime(astronomy.sunset);
  moonriseTimeEl.textContent = formatEventTime(astronomy.moonrise);
  moonsetTimeEl.textContent = formatEventTime(astronomy.moonset);
  moonPhaseEl.textContent = `Moon: ${getMoonPhase(astronomy.date)}`;
}

function calculateAstronomy(dayKey) {
  const date = getDateFromDayKey(dayKey);
  const observer = new Astronomy.Observer(LOCATION.lat, LOCATION.lon, 0);
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  return {
    date,
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

function formatEventTime(value) {
  if (!(value instanceof Date)) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LOCATION.timezone,
    hour: 'numeric',
    minute: '2-digit'
  }).format(value);
}

function getFeelsText(entry) {
  const apparent = Number.isFinite(entry?.apparentTemperature)
    ? formatTemperature(entry.apparentTemperature)
    : '';
  const comfort = getComfortLabel(entry);

  if (!apparent && !comfort) return '';
  if (apparent && comfort) return `Feels: ${apparent} · ${comfort}`;
  return apparent ? `Feels: ${apparent}` : `Feels: ${comfort}`;
}

function getComfortLabel(entry) {
  const apparent = toDisplayTemperature(entry?.apparentTemperature);
  const dewPoint = toDisplayTemperature(entry?.dewPoint);
  const windSpeed = toDisplayWindSpeed(entry?.windSpeed);
  const isMetric = unitSystem === UNIT_SYSTEMS.metric;

  if (!Number.isFinite(apparent)) return null;

  let label;
  if (apparent < (isMetric ? 12 : 54)) label = 'Cool';
  else if (apparent < (isMetric ? 18 : 64)) label = 'Comfortable';
  else if (apparent < (isMetric ? 23 : 73)) label = 'Warm';
  else label = 'Hot';

  if (Number.isFinite(windSpeed) && windSpeed >= (isMetric ? 28 : 17) && apparent <= (isMetric ? 18 : 64)) {
    label = 'Wind-chilled';
  }

  if (Number.isFinite(dewPoint) && dewPoint >= (isMetric ? 18 : 64) && apparent >= (isMetric ? 22 : 72)) {
    label = 'Humid';
  }

  return label;
}

function getWindTrendSummary(entries) {
  if (!entries.length) return 'Wind stays fairly steady.';

  const speeds = entries.map(entry => entry.windSpeed || 0);
  const first = speeds[0];
  const last = speeds[speeds.length - 1];
  const peak = Math.max(...speeds);
  const peakEntry = entries.find(entry => entry.windSpeed === peak);

  if (peak - Math.min(...speeds) <= 6) {
    return 'Wind stays fairly steady through the daytime window.';
  }
  if (last - first >= 8) {
    return 'Wind builds through the afternoon.';
  }
  if (first - last >= 8) {
    return 'Wind eases through the afternoon.';
  }
  if (peakEntry) {
    return `Strongest wind looks close to ${formatHour(peakEntry.time)}.`;
  }

  return 'Wind changes modestly through the day.';
}

function hasSeaState(entry) {
  return Number.isFinite(entry?.waveHeight)
    || Number.isFinite(entry?.wavePeriod)
    || Number.isFinite(entry?.waveDirectionDeg)
    || Number.isFinite(entry?.seaTemp);
}

function formatTemperature(value) {
  if (!Number.isFinite(value)) return '--';
  const displayValue = toDisplayTemperature(value);
  return `${Math.round(displayValue)}°${unitSystem === UNIT_SYSTEMS.metric ? 'C' : 'F'}`;
}

function formatWind(speed, directionDeg) {
  if (!Number.isFinite(speed)) return '--';
  const direction = formatDirection(directionDeg);
  const displaySpeed = toDisplayWindSpeed(speed);
  const unit = unitSystem === UNIT_SYSTEMS.metric ? 'km/h' : 'mph';
  return `${Math.round(displaySpeed)} ${unit}${direction ? ` ${direction}` : ''}`;
}

function formatWaveHeight(value) {
  if (!Number.isFinite(value)) return '--';
  const displayValue = toDisplayWaveHeight(value);
  const unit = unitSystem === UNIT_SYSTEMS.metric ? 'm' : 'ft';
  const decimals = unitSystem === UNIT_SYSTEMS.metric ? 1 : 0;
  return `${displayValue.toFixed(decimals)} ${unit}`;
}

function formatWavePeriod(value) {
  return Number.isFinite(value) ? `${Math.round(value)} s` : '--';
}

function formatTideHeight(value) {
  if (!Number.isFinite(value)) return '--';

  const displayValue = toDisplayWaveHeight(value);
  const unit = unitSystem === UNIT_SYSTEMS.metric ? 'm' : 'ft';
  const precision = unitSystem === UNIT_SYSTEMS.metric ? 2 : 1;
  return `${displayValue.toFixed(precision)} ${unit} rel. MSL`;
}

function formatDirection(value) {
  if (!Number.isFinite(value)) return '';

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((((value % 360) + 360) % 360) / 45) % directions.length;
  return directions[index];
}

function tideLabel(type) {
  return type === 'H' ? 'High' : 'Low';
}

function toDisplayTemperature(value) {
  if (!Number.isFinite(value)) return null;
  return unitSystem === UNIT_SYSTEMS.metric ? value : ((value * 9) / 5) + 32;
}

function toDisplayWindSpeed(value) {
  if (!Number.isFinite(value)) return null;
  return unitSystem === UNIT_SYSTEMS.metric ? value : value * 0.621371;
}

function toDisplayWaveHeight(value) {
  if (!Number.isFinite(value)) return null;
  return unitSystem === UNIT_SYSTEMS.metric ? value : value * 3.28084;
}

function getRoundedChartMax(value, step) {
  return Math.max(step, Math.ceil(value / step) * step);
}

function getWindStep() {
  return unitSystem === UNIT_SYSTEMS.metric ? 5 : 5;
}

function getTemperatureSpreadFloor() {
  return unitSystem === UNIT_SYSTEMS.metric ? 4 : 8;
}

function formatWeekday(dayKey) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LOCATION.timezone,
    weekday: 'short'
  }).format(getDateFromDayKey(dayKey));
}

function formatShortDate(dayKey) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LOCATION.timezone,
    month: 'short',
    day: 'numeric'
  }).format(getDateFromDayKey(dayKey));
}

function formatLongDate(dayKey) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LOCATION.timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(getDateFromDayKey(dayKey));
}

function formatHour(isoText) {
  return formatCompactHour(getHourFromIso(isoText));
}

function formatHourRange(startHour, endHour) {
  return `${formatCompactHour(startHour)}–${formatCompactHour(endHour)}`;
}

function formatCompactHour(hour24) {
  if (!Number.isFinite(hour24)) return '--';
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12} ${suffix}`;
}

function getDayKeyFromIso(value) {
  return String(value).slice(0, 10);
}

function getHourFromIso(value) {
  return Number.parseInt(String(value).slice(11, 13), 10);
}

function getCurrentDateKey() {
  return getZonedParts(new Date()).dateKey;
}

function getCurrentHourFraction() {
  const parts = getZonedParts(new Date());
  return parts.hour + (parts.minute / 60);
}

function getZonedParts(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: LOCATION.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function getDateFromDayKey(dayKey) {
  return new Date(`${dayKey}T12:00:00Z`);
}

function getMoonPhaseName(date = new Date()) {
  const synodicMonth = 29.53058867;
  const knownNewMoon = new Date('2000-01-06T18:14:00Z');
  const days = (date - knownNewMoon) / 86400000;
  const age = ((days % synodicMonth) + synodicMonth) % synodicMonth;

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

function getMoonPhase(date = new Date()) {
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
