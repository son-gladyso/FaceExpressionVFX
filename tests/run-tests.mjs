const g = globalThis;
g.window = g;
g.document = { hidden: false };
Object.defineProperty(g, 'navigator', { value: { mediaDevices: null }, configurable: true });
Object.defineProperty(g, 'location', { value: { hostname: 'localhost', protocol: 'https:' }, configurable: true });

await import('../face-config.js');
await import('../face-policies.js');
await import('../face-helpers.js');
await import('../face-au-detector.js');
await import('../face-quality.js');
await import('../face-temporal.js');
await import('../face-observables.js');
await import('../face-model-adapter.js');
await import('../face-detector.js');
await import('../face-i18n.js');
await import('../face-export.js');
await import('../face-history.js');

let passed = 0;
const failures = [];
function assert(value, message) {
  if (value) passed++;
  else { failures.push(message); console.error('FAIL:', message); }
}
function near(a, b, epsilon = 1e-6) { return Math.abs(a - b) <= epsilon; }
function landmarks() {
  const points = Array.from({ length: 478 }, (_, i) => ({
    x: 0.25 + (i % 20) * 0.025,
    y: 0.15 + (Math.floor(i / 20) % 20) * 0.035,
    z: 0,
  }));
  points[10] = { x: 0.5, y: 0.10, z: 0 };
  points[152] = { x: 0.5, y: 0.90, z: 0 };
  points[234] = { x: 0.20, y: 0.50, z: 0 };
  points[454] = { x: 0.80, y: 0.50, z: 0 };
  points[1] = { x: 0.50, y: 0.45, z: -0.03 };
  return points;
}
function aus(overrides = {}) {
  return Object.assign(Object.fromEntries(g.FaceConfig.AU_LIST.map((key) => [key, 0])), {
    overallAsymmetry: 0, earAvg: 0.3,
  }, overrides);
}

assert(g.FaceConfig.AU_LIST.length === 20, '20 AU channels configured');
assert(g.FaceConfig.OBSERVABLE_KEYS.length === 12, '12 observable summaries configured');
assert(g.FaceHelpers.isValidFaceLandmarks(landmarks()), 'synthetic landmarks valid');

const lm = landmarks();
const landmarkQuality = g.FaceQuality.computeLandmarkQuality(lm, { yaw: 0, pitch: 0, roll: 0 });
assert(landmarkQuality.score > 0.5, 'frontal landmarks receive usable quality');
const sideQuality = g.FaceQuality.computeLandmarkQuality(lm, { yaw: 70, pitch: 0, roll: 0 });
assert(sideQuality.pose < 0.1, 'large yaw is rejected by pose component');

function imageData(kind) {
  const width = 32, height = 24;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const x = i % width, y = Math.floor(i / width);
    const value = kind === 'dark' ? 2 : kind === 'flat' ? 128 : ((x + y) % 2 ? 40 : 220);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}
const clearPixels = g.FaceQuality.computePixelQuality(imageData('detail'), lm);
const darkPixels = g.FaceQuality.computePixelQuality(imageData('dark'), lm);
assert(clearPixels.sharpness > darkPixels.sharpness, 'blur/sharpness proxy distinguishes detailed frame');
assert(darkPixels.lighting < 0.3, 'underexposure lowers lighting score');
const pausedQuality = g.FaceQuality.combineQuality(sideQuality, darkPixels);
assert(pausedQuality.action === 'pause', 'oblique underexposed frame pauses output');
const missingPixel = g.FaceQuality.combineQuality(landmarkQuality, null);
assert(missingPixel.reasons.includes('pixel_quality_unavailable'), 'missing pixel evidence is explicit');

const calibration = { locked: true, confidence: 0.9 };
const goodQuality = {
  score: 0.9, action: 'pass', confidenceScale: 0.94, reasons: [],
  regions: { brow: 0.9, eyes: 0.9, nose: 0.9, mouth: 0.9, jaw: 0.9 },
};
const intervals = g.FaceQuality.estimateAUIntervals(aus({ au12: 0.6 }), goodQuality, calibration);
assert(Object.keys(intervals).length === 20, 'every AU has an estimate interval');
assert(intervals.au12.lower <= 0.6 && intervals.au12.upper >= 0.6, 'AU interval contains estimate');
assert(intervals.au12.lower >= 0 && intervals.au12.upper <= 1, 'AU interval is bounded');
const poorIntervals = g.FaceQuality.estimateAUIntervals(aus({ au12: 0.6 }), {
  score: 0.4, regions: { mouth: 0.3 },
}, { locked: false, confidence: 0.2 });
assert(poorIntervals.au12.confidence < intervals.au12.confidence, 'quality/calibration lower AU confidence');
assert((poorIntervals.au12.upper - poorIntervals.au12.lower) >
  (intervals.au12.upper - intervals.au12.lower), 'low confidence widens interval');

const calibrator = g.FaceAUDetector.createCalibrator(12, { driftAlpha: 0.1 });
for (let i = 0; i < 12; i++) calibrator.observe({ mar: 0.20 + (i % 3) * 0.001, ear: 0.30 }, { quality: goodQuality });
assert(calibrator.isLocked(), 'robust calibration locks after accepted frames');
const baselineBefore = calibrator.getBaseline().mar;
calibrator.observe({ mar: 0.205, ear: 0.30 }, { quality: goodQuality, activity: 0.01 });
assert(calibrator.getStatus().adapted === 1, 'neutral high-quality frame updates slow drift');
assert(calibrator.getBaseline().mar > baselineBefore, 'drift moves baseline gradually');
calibrator.observe({ mar: 0.9, ear: 0.05 }, { quality: { ...goodQuality, action: 'pause', score: 0.2 }, activity: 0 });
assert(calibrator.getStatus().rejected === 1, 'paused frame is rejected from calibration');

const temporalState = g.FaceTemporal.createState({ candidateHoldMs: 50, minHoldNeutralMs: 50 });
let temporal = g.FaceTemporal.update(temporalState, [{ name: 'au12', confidence: 0.9 }], 1000, goodQuality);
temporal = g.FaceTemporal.update(temporalState, [{ name: 'au12', confidence: 0.9 }], 1100, goodQuality);
temporal = g.FaceTemporal.update(temporalState, [{ name: 'au12', confidence: 0.9 }], 1200, goodQuality);
assert(temporal.label === 'au12', 'duration-aware Bayesian filter adopts sustained AU state');
assert(temporal.confidence >= 0 && temporal.confidence <= 1, 'posterior confidence bounded');
assert(temporal.entropy >= 0 && temporal.entropy <= 1, 'posterior uncertainty bounded');
const held = g.FaceTemporal.update(temporalState, [], 1250, { ...goodQuality, action: 'pause', confidenceScale: 0 });
assert(held.paused && held.confidence === 0, 'temporal output pauses without changing state');

const observable = g.FaceObservables.compute(aus({ au1: 0.4, au2: 0.7, au12: 0.6, overallAsymmetry: 0.2 }),
  null, goodQuality, intervals, temporal);
assert(near(observable.values.browRaise, 0.7), 'observable brow raise maps to strongest AU1/AU2');
assert(near(observable.values.lipCornerPull, 0.6), 'observable lip corner pull maps to AU12');
assert(near(observable.values.bilateralAsymmetry, 0.2), 'observable asymmetry remains geometric');
assert(Object.keys(observable.intervals).length === 12, 'all observable summaries include intervals');

assert(!g.FaceModelAdapter.validateMetadata({ name: 'x' }), 'model without provenance is disabled');
const provider = {
  metadata: { name: 'fixture', version: '1', license: 'MIT', trainingData: 'synthetic', labelMap: { au12: 12 }, metrics: { f1: 0.5 } },
  predict: () => ({ values: { au12: 1 }, confidence: 0.8 }),
};
const adapter = g.FaceModelAdapter.create(provider, { maxModelWeight: 0.5 });
assert(adapter.isEnabled(), 'complete model provenance enables provider');
const fused = adapter.fuse(aus({ au12: 0.2 }), adapter.predict({}), goodQuality);
assert(fused.source === 'hybrid', 'lawful model can be fused');
assert(fused.aus.au12 > 0.2 && fused.aus.au12 < 1, 'hybrid keeps rule contribution');
const fallback = g.FaceModelAdapter.create(null).fuse(aus({ au12: 0.2 }), null, goodQuality);
assert(fallback.source === 'rules' && near(fallback.aus.au12, 0.2), 'rules are deterministic fallback');

const pipeline = g.FaceDetector.createPipeline();
const paused = pipeline.process(lm, { quality: pausedQuality, headPose: { yaw: 70, pitch: 0, roll: 0 }, now: 1000 });
assert(paused.paused, 'pipeline halts inference on failed quality gate');
assert(!('psychology' in paused) && !('authenticity' in paused), 'pipeline exposes no psychological conclusions');
const activeResult = pipeline.process(lm, { quality: goodQuality, headPose: { yaw: 0, pitch: 0, roll: 0 }, now: 2000 });
assert(activeResult && !activeResult.paused, 'usable frame completes observable pipeline');
assert(Object.keys(activeResult.auEstimates).length === 20, 'pipeline returns interval for every AU');
assert(Object.keys(activeResult.observables.values).length === 12, 'pipeline returns 12 observable movements');
assert(activeResult.temporal && Number.isFinite(activeResult.temporal.entropy), 'pipeline returns Bayesian uncertainty');
assert(!('expressions' in activeResult) && !('topExpr' in activeResult), 'pipeline does not expose emotion labels');

const exportResult = {
  schemaVersion: '3.11.0', paused: false, quality: goodQuality, calibration: calibrator.getStatus(),
  auEstimates: intervals, observables: observable, temporal, headPose: { yaw: 1, pitch: 2, roll: 3 },
  inferenceSource: 'rules', calibrated: true, blinkCount: 2,
};
const snapshot = g.FaceExport.buildSnapshot(exportResult);
assert(snapshot.auEstimates.au12.lower !== undefined, 'JSON export preserves AU interval');
assert(snapshot.notice.includes('not identity'), 'JSON export carries scope notice');
assert(!('psychology' in snapshot) && !('authenticity' in snapshot), 'JSON export omits unsupported conclusions');
const flat = g.FaceExport.flattenResult(exportResult);
assert(flat.au12_lower && flat.au12_upper && flat.au12_confidence, 'CSV has AU interval columns');
assert(!Object.keys(flat).some((key) => /psych|authentic|decept/i.test(key)), 'CSV has no psychological columns');
assert(g.FaceExport.buildCSV([flat]).includes('temporal_uncertainty'), 'CSV includes temporal uncertainty');

const sessions = [{ startTime: 1, endTime: 2, snapshots: [
  { q: 0.8, qa: 'pass', obs: { browRaise: 0.2 } },
  { q: 0.6, qa: 'downweight', obs: { browRaise: 0.4 } },
] }];
const trend = g.FaceHistory.computeTrend(sessions);
assert(near(trend.avgObservables.browRaise, 0.3), 'history trends observable movement');
assert(trend.quality.downweighted === 1, 'history tracks quality actions');

g.FaceI18n.setLocale('zh-CN');
assert(g.FaceI18n.observableLabel('mouthOpening') === '口部张开', 'Chinese observable label available');
g.FaceI18n.setLocale('en-US');
assert(g.FaceI18n.observableLabel('mouthOpening') === 'Mouth Opening', 'English observable label available');

console.log(`\nFaceVFX v3.11: ${passed} PASS, ${failures.length} FAIL`);
if (failures.length) process.exit(1);
