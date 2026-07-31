import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = source.indexOf('function estimateNearshoreBreaking');
const end = source.indexOf('async function fetchWaterTempSource');

assert.ok(start > 0, 'wave model block start not found');
assert.ok(end > start, 'wave model block end not found');

const context = {
  console,
  Math,
  Date,
  Number,
  RangeError,
  Error,
  Object,
  WAVE_MODEL_STATUS: Object.freeze({
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
  }),
  GRAVITY_MPS2: 9.80665,
  TWO_PI: 2 * Math.PI,
  WAVE_MODEL_LIMITS: Object.freeze({
    minWaveHeightM: 0.01,
    maxWaveHeightM: 15,
    minWavePeriodS: 1,
    maxWavePeriodS: 30,
    minReferenceDepthM: 0.1,
    maxReferenceDepthM: 500,
    waveDataMaxAgeMinutes: 90,
    tideDataMaxAgeMinutes: 30
  })
};

vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}
this.estimateNearshoreBreaking = estimateNearshoreBreaking;
this.getLatDepthM = getLatDepthM;
this.getBedElevationRelativeToLatM = getBedElevationRelativeToLatM;
this.getCurrentOffshoreDepthM = getCurrentOffshoreDepthM;
this.calculateCurrentWaterlineXM = calculateCurrentWaterlineXM;
this.calculateBreakPointXM = calculateBreakPointXM;
this.calculateBreakDistanceFromWaterlineM = calculateBreakDistanceFromWaterlineM;
this.solveWaveNumber = solveWaveNumber;
this.interpolateTideHeight = interpolateTideHeight;
this.convertTideToModelDatum = convertTideToModelDatum;
`, context);

const approx = (actual, expected, tolerance, message) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
};

assert.equal(context.getLatDepthM({ xM: 0, offshoreSlope: 0.02 }), 0);
assert.equal(context.getLatDepthM({ xM: 50, offshoreSlope: 0.02 }), 1);
assert.equal(context.getLatDepthM({ xM: 100, offshoreSlope: 0.02 }), 2);
assert.equal(context.getLatDepthM({ xM: 200, offshoreSlope: 0.02 }), 4);

assert.equal(context.getBedElevationRelativeToLatM({ xM: -1, offshoreSlope: 0.02, landwardSlope: 0.2 }), 0.2);
assert.equal(context.getBedElevationRelativeToLatM({ xM: -5, offshoreSlope: 0.02, landwardSlope: 0.2 }), 1);
assert.equal(context.getCurrentOffshoreDepthM({ xM: 50, tideAboveLatM: 0.75, offshoreSlope: 0.02 }), 1.75);
assert.equal(context.calculateCurrentWaterlineXM({ tideAboveLatM: 0.75, landwardSlope: 0.2 }), -3.75);
assert.equal(context.calculateBreakPointXM({ breakingDepthM: 1.82, tideAboveLatM: 0.75, offshoreSlope: 0.02 }), 53.5);
assert.equal(context.calculateBreakDistanceFromWaterlineM({ breakPointXM: 53.5, currentWaterlineXM: -3.75 }), 57.25);

const dispersion = context.solveWaveNumber({ periodS: 8, depthM: 3 });
approx(dispersion.waveNumberRadPerM, 0.1495, 0.002, 'dispersion k');
approx(dispersion.wavelengthM, 42.0, 0.6, 'dispersion wavelength');
approx(dispersion.groupVelocityMps, 4.9, 0.3, 'dispersion group velocity');

const datum = context.convertTideToModelDatum({
  heightAbovePublishedDatumM: 0.7,
  publishedDatum: 'MLLW',
  publishedDatumToLatOffsetM: 0.12,
  modelDatum: 'LAT',
  allowApproximateDatum: false
});
assert.equal(datum.tideAboveLatM, 0.82);
assert.equal(datum.datumConversionApplied, true);

const now = new Date('2026-07-31T11:15:00Z');
const baseConfig = {
  enabled: true,
  profileDatum: 'LAT',
  offshoreSlope: 1 / 50,
  landwardSlope: 1 / 5,
  maxProfileDepthM: 4,
  breakerIndexGamma: 0.55,
  allowApproximateDatum: true,
  profileStepM: 1,
  breakDistanceToleranceM: 0.1
};
const model = context.estimateNearshoreBreaking({
  locationId: 'belmar',
  locationConfig: baseConfig,
  offshoreWave: {
    significantHeightM: 0.8,
    periodS: 8,
    referenceDepthM: 25,
    observationTime: now.toISOString()
  },
  tide: {
    heightAbovePublishedDatumM: 0.75,
    publishedDatum: 'MLLW',
    publishedDatumToLatOffsetM: null,
    evaluationTime: now.toISOString()
  },
  now
});

assert.equal(model.status, 'ok');
approx(model.breaking.localDepthM, 1.93, 0.06, 'breaking depth');
approx(model.breaking.waveHeightM, 1.06, 0.06, 'breaking height');
approx(model.breaking.wavelengthM, 33, 1.2, 'breaking wavelength');
assert.equal(model.breaking.governingCriterion, 'depth');

const landwardSlopeVariant = context.estimateNearshoreBreaking({
  locationId: 'belmar',
  locationConfig: { ...baseConfig, landwardSlope: 1 / 10 },
  offshoreWave: {
    significantHeightM: 0.8,
    periodS: 8,
    referenceDepthM: 25,
    observationTime: now.toISOString()
  },
  tide: {
    heightAbovePublishedDatumM: 0.75,
    publishedDatum: 'MLLW',
    publishedDatumToLatOffsetM: null,
    evaluationTime: now.toISOString()
  },
  now
});

approx(landwardSlopeVariant.breaking.localDepthM, model.breaking.localDepthM, 0.0001, 'landward slope depth isolation');
approx(landwardSlopeVariant.breaking.waveHeightM, model.breaking.waveHeightM, 0.0001, 'landward slope wave-height isolation');
assert.notEqual(landwardSlopeVariant.breaking.distanceFromCurrentWaterlineM, model.breaking.distanceFromCurrentWaterlineM);

assert.equal(context.interpolateTideHeight({
  beforeTimeMs: 0,
  beforeHeightM: 0,
  afterTimeMs: 1000,
  afterHeightM: 1,
  targetTimeMs: 250
}), 0.25);

console.log('wave-model tests passed');
