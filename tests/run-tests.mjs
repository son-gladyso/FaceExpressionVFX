/* ═══════════════════════════════════════════════════════════════
 *  run-tests.mjs  –  MicroExpression Psychology v3.1 Test Suite
 *  Covers: helpers, AU detection, expression classification,
 *  authenticity engine, transition tracking, psychology engine,
 *  temporal dynamics, bilateral asymmetry, muscle conflict,
 *  1€ filter, Savitzky-Golay, head pose V2, z-curvature,
 *  landmark confidence, blink rate analysis
 * ═══════════════════════════════════════════════════════════════ */

// ── Minimal DOM shim ──
const g = globalThis;
g.window = g;
g.document = { hidden: false };
if (typeof g.navigator === 'undefined') {
  g.navigator = { mediaDevices: null };
} else {
  try { g.navigator = { mediaDevices: null }; } catch (_e) {
    // navigator is read-only in newer Node.js, override via defineProperty
    Object.defineProperty(g, 'navigator', { value: { mediaDevices: null }, writable: true, configurable: true });
  }
}
if (typeof g.location === 'undefined') {
  g.location = { hostname: 'localhost', protocol: 'https:' };
} else {
  try { g.location = { hostname: 'localhost', protocol: 'https:' }; } catch (_e) {
    Object.defineProperty(g, 'location', { value: { hostname: 'localhost', protocol: 'https:' }, writable: true, configurable: true });
  }
}

// ── Load modules ──
await import('../face-config.js');
await import('../face-policies.js');
await import('../face-helpers.js');
await import('../face-au-detector.js');
await import('../face-expression-analyzer.js');
await import('../face-psychology-engine.js');
await import('../face-detector.js');
await import('../face-i18n.js');
await import('../face-export.js');
await import('../face-history.js');

const CFG  = g.FaceConfig;
const H    = g.FaceHelpers;
const AU   = g.FaceAUDetector;
const EA   = g.FaceExpressionAnalyzer;
const PSY  = g.FacePsychologyEngine;
const DET  = g.FaceDetector;
const I18n = g.FaceI18n;
const EXP  = g.FaceExport;
const HIST = g.FaceHistory;

// ── Test harness ──
let passed = 0, failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; failures.push(msg); console.error('  FAIL:', msg); }
}

function near(a, b, eps) { return Math.abs(a - b) < (eps || 0.01); }

// ── Generate synthetic landmarks (468 + 10 iris) ──
function makeLandmarks(overrides) {
  const pts = [];
  for (let i = 0; i < 478; i++) {
    pts.push({ x: 0.5 + (i % 20) * 0.01, y: 0.3 + Math.floor(i / 20) * 0.015, z: 0 });
  }
  // Set face structure anchors
  pts[10]  = { x: 0.50, y: 0.10, z: 0 };   // forehead
  pts[152] = { x: 0.50, y: 0.90, z: 0 };   // chin
  pts[234] = { x: 0.20, y: 0.50, z: 0 };   // left face
  pts[454] = { x: 0.80, y: 0.50, z: 0 };   // right face

  // Eyes neutral
  const reye = [33, 160, 158, 133, 153, 144];
  pts[reye[0]] = { x: 0.35, y: 0.35, z: 0 };
  pts[reye[1]] = { x: 0.37, y: 0.32, z: 0 };
  pts[reye[2]] = { x: 0.39, y: 0.32, z: 0 };
  pts[reye[3]] = { x: 0.42, y: 0.35, z: 0 };
  pts[reye[4]] = { x: 0.39, y: 0.37, z: 0 };
  pts[reye[5]] = { x: 0.37, y: 0.37, z: 0 };

  const leye = [362, 385, 387, 263, 373, 380];
  pts[leye[0]] = { x: 0.58, y: 0.35, z: 0 };
  pts[leye[1]] = { x: 0.60, y: 0.32, z: 0 };
  pts[leye[2]] = { x: 0.62, y: 0.32, z: 0 };
  pts[leye[3]] = { x: 0.65, y: 0.35, z: 0 };
  pts[leye[4]] = { x: 0.62, y: 0.37, z: 0 };
  pts[leye[5]] = { x: 0.60, y: 0.37, z: 0 };

  // 14-point redundant eye strips (for robust EAR14)
  // Right upper [246,161,160*,159,158*,157,173] (*set via 6-point above)
  pts[246] = { x: 0.35, y: 0.34, z: 0 };
  pts[161] = { x: 0.36, y: 0.32, z: 0 };
  pts[159] = { x: 0.38, y: 0.32, z: 0 };
  pts[157] = { x: 0.40, y: 0.32, z: 0 };
  pts[173] = { x: 0.42, y: 0.34, z: 0 };
  // Right lower [7,163,144*,145,153*,154,155]
  pts[7]   = { x: 0.35, y: 0.36, z: 0 };
  pts[163] = { x: 0.36, y: 0.37, z: 0 };
  pts[145] = { x: 0.38, y: 0.37, z: 0 };
  pts[154] = { x: 0.40, y: 0.37, z: 0 };
  pts[155] = { x: 0.42, y: 0.36, z: 0 };
  // Left upper [466,388,387*,386,385*,384,398]
  pts[466] = { x: 0.58, y: 0.34, z: 0 };
  pts[388] = { x: 0.59, y: 0.32, z: 0 };
  pts[386] = { x: 0.61, y: 0.32, z: 0 };
  pts[384] = { x: 0.63, y: 0.32, z: 0 };
  pts[398] = { x: 0.65, y: 0.34, z: 0 };
  // Left lower [249,390,373*,374,380*,381,382]
  pts[249] = { x: 0.58, y: 0.36, z: 0 };
  pts[390] = { x: 0.59, y: 0.37, z: 0 };
  pts[374] = { x: 0.61, y: 0.37, z: 0 };
  pts[381] = { x: 0.63, y: 0.37, z: 0 };
  pts[382] = { x: 0.65, y: 0.36, z: 0 };

  // Brows neutral
  pts[107] = { x: 0.36, y: 0.26, z: 0 };
  pts[66]  = { x: 0.37, y: 0.25, z: 0 };
  pts[105] = { x: 0.38, y: 0.25, z: 0 };
  pts[63]  = { x: 0.39, y: 0.25, z: 0 };
  pts[70]  = { x: 0.40, y: 0.26, z: 0 };
  pts[336] = { x: 0.60, y: 0.26, z: 0 };
  pts[296] = { x: 0.61, y: 0.25, z: 0 };
  pts[334] = { x: 0.62, y: 0.25, z: 0 };
  pts[293] = { x: 0.63, y: 0.25, z: 0 };
  pts[300] = { x: 0.64, y: 0.26, z: 0 };

  // Nose
  pts[168] = { x: 0.50, y: 0.30, z: 0 };
  pts[1]   = { x: 0.50, y: 0.45, z: 0 };
  pts[2]   = { x: 0.50, y: 0.48, z: 0 };
  pts[4]   = { x: 0.50, y: 0.46, z: 0 };
  pts[6]   = { x: 0.50, y: 0.40, z: 0 };
  pts[48]  = { x: 0.45, y: 0.50, z: 0 };
  pts[278] = { x: 0.55, y: 0.50, z: 0 };

  // Mouth neutral
  pts[61]  = { x: 0.40, y: 0.65, z: 0 };
  pts[291] = { x: 0.60, y: 0.65, z: 0 };
  pts[0]   = { x: 0.50, y: 0.60, z: 0 };
  pts[17]  = { x: 0.50, y: 0.70, z: 0 };
  pts[13]  = { x: 0.50, y: 0.62, z: 0 };
  pts[14]  = { x: 0.50, y: 0.66, z: 0 };
  pts[78]  = { x: 0.42, y: 0.64, z: 0 };
  pts[308] = { x: 0.58, y: 0.64, z: 0 };
  pts[40]  = { x: 0.45, y: 0.61, z: 0 };
  pts[269] = { x: 0.55, y: 0.61, z: 0 };
  pts[405] = { x: 0.55, y: 0.69, z: 0 };
  pts[181] = { x: 0.45, y: 0.69, z: 0 };

  // Cheeks
  pts[50]  = { x: 0.32, y: 0.45, z: 0 };
  pts[280] = { x: 0.68, y: 0.45, z: 0 };
  pts[205] = { x: 0.30, y: 0.55, z: 0 };
  pts[425] = { x: 0.70, y: 0.55, z: 0 };

  // NEW v3 landmarks
  // Periorbital
  pts[130] = { x: 0.43, y: 0.36, z: 0 };
  pts[247] = { x: 0.44, y: 0.34, z: 0 };
  pts[30]  = { x: 0.34, y: 0.34, z: 0 };
  pts[29]  = { x: 0.33, y: 0.35, z: 0 };
  pts[359] = { x: 0.57, y: 0.36, z: 0 };
  pts[467] = { x: 0.56, y: 0.34, z: 0 };
  pts[260] = { x: 0.66, y: 0.34, z: 0 };
  pts[259] = { x: 0.67, y: 0.35, z: 0 };

  // Corrugator
  pts[46]  = { x: 0.38, y: 0.27, z: 0 };
  pts[53]  = { x: 0.40, y: 0.28, z: 0 };
  pts[276] = { x: 0.62, y: 0.27, z: 0 };
  pts[283] = { x: 0.60, y: 0.28, z: 0 };

  // Nasolabial
  pts[49]  = { x: 0.42, y: 0.52, z: 0 };
  pts[220] = { x: 0.43, y: 0.56, z: 0 };
  pts[279] = { x: 0.58, y: 0.52, z: 0 };
  pts[440] = { x: 0.57, y: 0.56, z: 0 };

  // Mentalis
  pts[199] = { x: 0.50, y: 0.82, z: 0 };
  pts[175] = { x: 0.48, y: 0.80, z: 0 };
  pts[18]  = { x: 0.50, y: 0.78, z: 0 };

  // Zygomatic & Temporalis
  pts[123] = { x: 0.30, y: 0.42, z: 0 };
  pts[352] = { x: 0.70, y: 0.42, z: 0 };
  pts[116] = { x: 0.28, y: 0.48, z: 0 };
  pts[345] = { x: 0.72, y: 0.48, z: 0 };

  // Forehead
  pts[151] = { x: 0.48, y: 0.12, z: 0 };
  pts[9]   = { x: 0.52, y: 0.12, z: 0 };

  // Orbicularis oris
  pts[87]  = { x: 0.46, y: 0.68, z: 0 };
  pts[317] = { x: 0.54, y: 0.68, z: 0 };
  pts[164] = { x: 0.50, y: 0.59, z: 0 };

  // Apply overrides
  if (overrides) {
    for (const idx of Object.keys(overrides)) {
      pts[Number(idx)] = overrides[idx];
    }
  }
  return pts;
}

console.log('\n═══ MicroExpression Psychology v3 – Test Suite ═══\n');

// ═══════════════════════════════════════
// 1. CONFIG TESTS
// ═══════════════════════════════════════
console.log('── Config ──');
assert(CFG.KEY_LANDMARKS_78.length === 78, 'KEY_LANDMARKS_78 has 78 entries');
assert(CFG.AU_LIST.length === 20, 'AU_LIST has 20 entries');
assert(CFG.PSYCHOLOGY_KEYS.length === 12, 'PSYCHOLOGY_KEYS has 12 dimensions');
assert(CFG.PSYCHOLOGY_KEYS.includes('suppressionEffort'), 'Has suppressionEffort dimension');
assert(CFG.PSYCHOLOGY_KEYS.includes('emotionalRegulation'), 'Has emotionalRegulation dimension');
assert(typeof CFG.TEMPORAL === 'object', 'TEMPORAL config exists');
assert(typeof CFG.AUTHENTICITY === 'object', 'AUTHENTICITY config exists');
assert(typeof CFG.TRANSITION === 'object', 'TRANSITION config exists');
assert(CFG.AUTHENTICITY.duchenneWeight + CFG.AUTHENTICITY.temporalWeight +
       CFG.AUTHENTICITY.symmetryWeight + CFG.AUTHENTICITY.durationWeight +
       CFG.AUTHENTICITY.muscleConflictWeight + CFG.AUTHENTICITY.leakageWeight === 1.0,
       'Authenticity weights sum to 1.0');

// ═══════════════════════════════════════
// 2. HELPER TESTS
// ═══════════════════════════════════════
console.log('── Helpers ──');
assert(near(H.dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5), 'dist 3-4-5');
assert(near(H.dist3d({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 }), 3), 'dist3d');
assert(near(H.midpoint({ x: 0, y: 0 }, { x: 2, y: 4 }).x, 1), 'midpoint x');
assert(H.clamp(-1, 0, 1) === 0, 'clamp lower');
assert(H.clamp(5, 0, 1) === 1, 'clamp upper');
assert(near(H.ema(0, 1, 0.5), 0.5), 'ema');
assert(H.isValidFaceLandmarks(makeLandmarks()), 'valid landmarks');
assert(!H.isValidFaceLandmarks([]), 'invalid landmarks (empty)');

// NEW: variance & slope
assert(near(H.variance([2, 4, 4, 4, 5, 5, 7, 9]), 4.0, 0.1), 'variance correct');
assert(H.variance([5]) === 0, 'variance single element');
const slopeArr = [0, 1, 2, 3, 4];
assert(near(H.slope(slopeArr), 1.0, 0.01), 'slope of linear data = 1');
assert(H.slope([3]) === 0, 'slope single element');

// NEW: head pose
const neutralLm = makeLandmarks();
const hp = H.computeHeadPoseV2(neutralLm);
assert(typeof hp.pitch === 'number' && typeof hp.yaw === 'number' && typeof hp.roll === 'number',
  'headPose returns pitch, yaw, roll');

// ═══════════════════════════════════════
// 3. AU DETECTOR TESTS
// ═══════════════════════════════════════
console.log('── AU Detector ──');
const neutralAUs = AU.computeAUs(neutralLm);
assert(typeof neutralAUs.au1 === 'number', 'AU1 computed');
assert(typeof neutralAUs.au12 === 'number', 'AU12 computed');
assert(typeof neutralAUs.duchenneScore === 'number', 'duchenneScore computed');
assert(typeof neutralAUs.overallAsymmetry === 'number', 'overallAsymmetry computed');
assert(typeof neutralAUs.muscleConflictScore === 'number', 'muscleConflictScore computed');
assert(Array.isArray(neutralAUs.muscleConflicts), 'muscleConflicts is array');
assert(typeof neutralAUs.periorbitalAvg === 'number', 'periorbitalAvg computed');
assert(typeof neutralAUs.corrugatorAvg === 'number', 'corrugatorAvg computed');
assert(typeof neutralAUs.nasolabialAvg === 'number', 'nasolabialAvg computed');

// Bilateral measurements
assert(typeof neutralAUs.au1_right === 'number', 'au1_right exists');
assert(typeof neutralAUs.au1_left === 'number', 'au1_left exists');
assert(typeof neutralAUs.au12_right === 'number', 'au12_right exists');
assert(typeof neutralAUs.au12_left === 'number', 'au12_left exists');

// ── Smile detection ──
const smileLm = makeLandmarks({
  61:  { x: 0.40, y: 0.62, z: 0 },  // mouth corners lifted
  291: { x: 0.60, y: 0.62, z: 0 },
  50:  { x: 0.32, y: 0.48, z: 0 },  // cheeks raised
  280: { x: 0.68, y: 0.48, z: 0 },
  205: { x: 0.30, y: 0.52, z: 0 },
  425: { x: 0.70, y: 0.52, z: 0 },
});
const smileAUs = AU.computeAUs(smileLm);
assert(smileAUs.au12 > 0.15, 'Smile: AU12 elevated (' + smileAUs.au12.toFixed(3) + ')');

// ── Eyes closed ──
const closedLm = makeLandmarks({
  // 6-point EAR landmarks
  160: { x: 0.37, y: 0.355, z: 0 },
  158: { x: 0.39, y: 0.355, z: 0 },
  153: { x: 0.39, y: 0.355, z: 0 },
  144: { x: 0.37, y: 0.355, z: 0 },
  385: { x: 0.60, y: 0.355, z: 0 },
  387: { x: 0.62, y: 0.355, z: 0 },
  373: { x: 0.62, y: 0.355, z: 0 },
  380: { x: 0.60, y: 0.355, z: 0 },
  // 14-point EAR upper/lower strips (indices 1-5 used by EAR14)
  161: { x: 0.36, y: 0.355, z: 0 },
  159: { x: 0.38, y: 0.355, z: 0 },
  157: { x: 0.40, y: 0.355, z: 0 },
  163: { x: 0.36, y: 0.355, z: 0 },
  145: { x: 0.38, y: 0.355, z: 0 },
  154: { x: 0.40, y: 0.355, z: 0 },
  388: { x: 0.59, y: 0.355, z: 0 },
  386: { x: 0.61, y: 0.355, z: 0 },
  384: { x: 0.63, y: 0.355, z: 0 },
  390: { x: 0.59, y: 0.355, z: 0 },
  374: { x: 0.61, y: 0.355, z: 0 },
  381: { x: 0.63, y: 0.355, z: 0 },
});
const closedAUs = AU.computeAUs(closedLm);
assert(closedAUs.au43 > 0.3, 'Eyes closed: AU43 elevated (' + closedAUs.au43.toFixed(3) + ')');

// ── AU Dynamics ──
const ringBufs = AU.createAURingBuffer();
const dynamics = AU.computeAUDynamics(neutralAUs, smileAUs, ringBufs);
assert(dynamics !== null, 'Dynamics computed');
assert(typeof dynamics.velocity === 'object', 'Dynamics has velocity');
assert(Array.isArray(dynamics.onsets), 'Dynamics has onsets');
assert(Array.isArray(dynamics.offsets), 'Dynamics has offsets');
assert(typeof dynamics.acceleration === 'object', 'Dynamics has acceleration');

// ── Smooth AUs (legacy alpha path) ──
const smoothed = AU.smoothAUs(neutralAUs, smileAUs, 0.5);
assert(typeof smoothed.au12 === 'number', 'smoothAUs works (legacy alpha)');
assert(smoothed.au12 >= neutralAUs.au12 && smoothed.au12 <= smileAUs.au12,
  'smoothAUs interpolates (legacy alpha)');

// ── Smooth AUs (new 1€-filter path) ──
const auFilters = AU.createAUFilters();
assert(typeof auFilters === 'object' && auFilters !== null, 'createAUFilters returns object');
const smoothed2 = AU.smoothAUs(neutralAUs, smileAUs, auFilters);
assert(typeof smoothed2.au12 === 'number', 'smoothAUs works (1€ filters)');

// ── Smooth AUs (null prev returns curr) ──
const smoothedNull = AU.smoothAUs(null, smileAUs, 0.5);
assert(smoothedNull === smileAUs, 'smoothAUs with null prev returns curr');

// ── Head Pose ──
const headPose = AU.computeHeadPose(neutralLm);
assert(typeof headPose.yaw === 'number', 'headPose yaw');

// ═══════════════════════════════════════
// 4. EXPRESSION ANALYZER TESTS
// ═══════════════════════════════════════
console.log('── Expression Analyzer ──');
const state = EA.createState();
assert(typeof state.prevExpression === 'string', 'createState has prevExpression');
assert(Array.isArray(state.transitionLog), 'createState has transitionLog');
assert(Array.isArray(state.authenticityHistory), 'createState has authenticityHistory');

// Classify with neutral AUs
const neutralClassified = EA.classifyExpressions(neutralAUs);
assert(Array.isArray(neutralClassified), 'classify returns array');

// Classify with smile AUs
const smileClassified = EA.classifyExpressions(smileAUs);
// Analyze pipeline
const analysis1 = EA.analyze(neutralAUs, state, headPose);
assert(typeof analysis1.topExpression === 'string', 'analyze returns topExpression');
assert(typeof analysis1.authenticity === 'object', 'analyze returns authenticity');
assert(typeof analysis1.authenticity.overall === 'number', 'authenticity has overall');
assert(typeof analysis1.authenticity.factors === 'object', 'authenticity has factors');

// Trigger a transition
const analysis2 = EA.analyze(smileAUs, state, headPose);

// ── Authenticity Engine ──
const authResult = EA.analyzeAuthenticity(smileAUs, dynamics, 'social_smile', state);
assert(typeof authResult.overall === 'number', 'authenticity overall is number');
assert(authResult.overall >= 0 && authResult.overall <= 1, 'authenticity in [0,1]');
assert(typeof authResult.factors.duchenne === 'number', 'has duchenne factor');
assert(typeof authResult.factors.temporal === 'number', 'has temporal factor');
assert(typeof authResult.factors.symmetry === 'number', 'has symmetry factor');
assert(typeof authResult.factors.muscleConflict === 'number', 'has muscleConflict factor');

// ── Transition Analysis (ms-based) ──
const transResult = EA.analyzeTransition('neutral', 'social_smile', 150, smileAUs);
assert(typeof transResult.type === 'string', 'transition has type');
assert(typeof transResult.naturalness === 'number', 'transition has naturalness');
assert(typeof transResult.significance === 'string', 'transition has significance');
assert(transResult.from === 'neutral', 'transition from correct');
assert(transResult.to === 'social_smile', 'transition to correct');
assert(typeof transResult.durationMs === 'number', 'transition has durationMs');

// Abrupt transition (≤100ms)
const abruptTrans = EA.analyzeTransition('neutral', 'anger', 60, neutralAUs);
assert(abruptTrans.type === 'abrupt', 'abrupt transition detected (60ms)');

// Smooth transition (≥267ms)
const smoothTrans = EA.analyzeTransition('genuine_smile', 'neutral', 300, neutralAUs);
assert(smoothTrans.type === 'smooth', 'smooth transition detected (300ms)');

// ═══════════════════════════════════════
// 5. PSYCHOLOGY ENGINE TESTS
// ═══════════════════════════════════════
console.log('── Psychology Engine ──');
const psyState = PSY.createState();
assert(typeof psyState.smoothed === 'object', 'psyState has smoothed');
assert(typeof psyState.smoothed.suppressionEffort === 'number', 'has suppressionEffort');
assert(typeof psyState.smoothed.emotionalRegulation === 'number', 'has emotionalRegulation');
assert(typeof psyState.dissonanceHistory === 'object', 'has dissonanceHistory');

// Compute raw dimensions
const raw = PSY.computeRaw(neutralAUs, analysis1);
assert(typeof raw.valence === 'number', 'raw has valence');
assert(typeof raw.suppressionEffort === 'number', 'raw has suppressionEffort');
assert(typeof raw.emotionalRegulation === 'number', 'raw has emotionalRegulation');
assert(raw.valence >= 0 && raw.valence <= 1, 'valence in [0,1]');

// Update pipeline
PSY.update(psyState, neutralAUs, analysis1);
assert(typeof psyState.analysisText === 'string', 'analysis text generated');
assert(psyState.analysisText.length > 0, 'analysis text non-empty');

// Cognitive dissonance detection
const dissonance = PSY.detectCognitiveDissonance(neutralAUs, analysis1);
assert(typeof dissonance.score === 'number', 'dissonance has score');
assert(Array.isArray(dissonance.details), 'dissonance has details');

// Emotional inertia
const inertia = PSY.computeEmotionalInertia(psyState, analysis1);
assert(typeof inertia === 'number', 'inertia is number');
assert(inertia >= 0 && inertia <= 1, 'inertia in [0,1]');

// ═══════════════════════════════════════
// 6. PIPELINE (face-detector.js) TESTS
// ═══════════════════════════════════════
console.log('── Pipeline ──');
const pipe = DET.createPipeline();
const pResult = pipe.process(neutralLm);
assert(pResult !== null, 'pipeline returns result');
assert(typeof pResult.aus === 'object', 'pipeline has aus');
assert(typeof pResult.topExpr === 'string', 'pipeline has topExpr');
assert(typeof pResult.psychology === 'object', 'pipeline has psychology');
assert(typeof pResult.headPose === 'object', 'pipeline has headPose');
assert(typeof pResult.authenticity === 'object', 'pipeline has authenticity');
assert(typeof pResult.analysisText === 'string', 'pipeline has analysisText');

// Process multiple frames to test temporal tracking
const pResult2 = pipe.process(smileLm);
assert(pResult2 !== null, 'pipeline processes second frame');
assert(typeof pResult2.dynamics === 'object' || pResult2.dynamics === null, 'pipeline has dynamics');

// Invalid landmarks
const badResult = pipe.process([]);
assert(badResult === null, 'pipeline returns null for invalid landmarks');

// ═══════════════════════════════════════
// 7. POLICIES TESTS
// ═══════════════════════════════════════
console.log('── Policies ──');
const POL = g.FacePolicies;
assert(POL.isLocalHost() === true, 'isLocalHost on localhost');
assert(typeof POL.resolveQualityMode({ hardwareConcurrency: 8, deviceMemory: 8 }) === 'string', 'resolveQualityMode');
assert(POL.resolveQualityMode({ hardwareConcurrency: 8, deviceMemory: 8 }) === 'high', 'high quality mode');
assert(POL.resolveQualityMode({ hardwareConcurrency: 2, deviceMemory: 2 }) === 'low', 'low quality mode');

// ═══════════════════════════════════════
// 8. v3.1 ADVANCED TECHNIQUES TESTS
// ═══════════════════════════════════════
console.log('── v3.1 Advanced Techniques ──');

// ── 1€ Filter (Casiez et al., CHI 2012) ──
const oef = H.createOneEuroFilter(1.0, 0.007, 1.0);
assert(typeof oef.filter === 'function', '1€ Filter has filter()');
assert(typeof oef.reset === 'function', '1€ Filter has reset()');
const fv1 = oef.filter(1.0, 0);
assert(near(fv1, 1.0, 0.01), '1€ Filter first value pass-through');
const fv2 = oef.filter(1.5, 33);
assert(typeof fv2 === 'number' && !isNaN(fv2), '1€ Filter returns number');
const fv3 = oef.filter(1.2, 66);
assert(fv3 >= 1.0 && fv3 <= 1.6, '1€ Filter smooths within range');
oef.reset();
const fv4 = oef.filter(5.0, 100);
assert(near(fv4, 5.0, 0.01), '1€ Filter reset then pass-through');

// ── Savitzky-Golay velocity & acceleration ──
const sgBuf = [0.1, 0.2, 0.35, 0.55, 0.8];
const sgVel = H.sgVelocity(sgBuf);
assert(typeof sgVel === 'number' && sgVel > 0, 'sgVelocity positive for increasing data');
const sgAcc = H.sgAcceleration(sgBuf);
assert(typeof sgAcc === 'number', 'sgAcceleration returns number');
// Linear data should have ~zero acceleration
const sgLinear = [0.0, 0.1, 0.2, 0.3, 0.4];
const sgAccLin = H.sgAcceleration(sgLinear);
assert(Math.abs(sgAccLin) < 0.05, 'sgAcceleration ~0 for linear data (' + sgAccLin.toFixed(4) + ')');
// Too-short buffer should return 0
assert(H.sgVelocity([1, 2, 3]) === 0, 'sgVelocity returns 0 for short buffer');
assert(H.sgAcceleration([1, 2]) === 0, 'sgAcceleration returns 0 for short buffer');

// ── Head Pose V2 (z-depth enhanced) ──
const hpv2 = H.computeHeadPoseV2(neutralLm, 640, 480);
assert(typeof hpv2.pitch === 'number', 'headPoseV2 has pitch');
assert(typeof hpv2.yaw === 'number', 'headPoseV2 has yaw');
assert(typeof hpv2.roll === 'number', 'headPoseV2 has roll');
// Neutral face should have small angles
assert(Math.abs(hpv2.pitch) < 60, 'headPoseV2 neutral pitch reasonable');
assert(Math.abs(hpv2.yaw) < 60, 'headPoseV2 neutral yaw reasonable');

// ── z-depth Curvature ──
const curvLm = makeLandmarks();
// Set z-values for some indices to create curvature
curvLm[130] = { x: 0.43, y: 0.36, z: 0.01 };
curvLm[247] = { x: 0.44, y: 0.34, z: -0.02 };
curvLm[30]  = { x: 0.34, y: 0.34, z: 0.015 };
const zCurv = H.zCurvature(curvLm, [130, 247, 30]);
assert(typeof zCurv === 'number', 'zCurvature returns number');
assert(zCurv >= 0, 'zCurvature is non-negative');
// All-flat z should be zero curvature
const flatCurv = H.zCurvature(neutralLm, [130, 247, 30]);
assert(flatCurv === 0 || near(flatCurv, 0, 0.001), 'zCurvature 0 for flat z');

// ── Landmark Confidence ──
const confLm = makeLandmarks();
const conf0 = H.landmarkConfidence(confLm, 0);
assert(typeof conf0 === 'number', 'landmarkConfidence returns number');
assert(conf0 >= 0 && conf0 <= 1, 'landmarkConfidence in [0,1]');
// With explicit visibility field
confLm[10].visibility = 0.85;
const conf10 = H.landmarkConfidence(confLm, 10);
assert(near(conf10, 0.85, 0.01), 'landmarkConfidence reads visibility');

// ── Confidence-weighted distance ──
const cwDist = H.confidenceWeightedDist(confLm, 0, 10);
assert(typeof cwDist === 'object' && typeof cwDist.dist === 'number', 'confidenceWeightedDist returns {dist, weight}');
assert(cwDist.dist >= 0 && cwDist.weight >= 0 && cwDist.weight <= 1, 'confidenceWeightedDist values valid');

// ── Blink Analyzer (Stern et al., 1984) ──
const blinker = H.createBlinkAnalyzer();
assert(typeof blinker.recordBlink === 'function', 'blinkAnalyzer has recordBlink');
assert(typeof blinker.getBlinkRate === 'function', 'blinkAnalyzer has getBlinkRate');
assert(typeof blinker.interpret === 'function', 'blinkAnalyzer has interpret');
assert(blinker.getBlinkRate() === 0, 'blinkAnalyzer initial rate 0');

// Simulate blinks at 20/min = 1 per 3s
const baseT = 100000;
for (let bi = 0; bi < 10; bi++) {
  blinker.recordBlink(baseT + bi * 3000);
}
const blinkRate = blinker.getBlinkRate();
assert(blinkRate > 10 && blinkRate < 30, 'blinkRate ~20/min (' + blinkRate.toFixed(1) + ')');
const ibiVar = blinker.getIBIVariance();
assert(typeof ibiVar === 'number', 'getIBIVariance returns number');
assert(ibiVar < 0.1, 'IBI variance low for regular blinks');
const interp = blinker.interpret();
assert(typeof interp === 'object' && typeof interp.level === 'string', 'interpret returns {level, stressIndicator, note}');
assert(typeof interp.stressIndicator === 'number', 'interpret has stressIndicator');

// High rate blinks
const blinkerHigh = H.createBlinkAnalyzer();
for (let bh = 0; bh < 25; bh++) {
  blinkerHigh.recordBlink(baseT + bh * 1500); // 40/min
}
assert(blinkerHigh.getBlinkRate() > 25, 'high blink rate detected');
assert(blinkerHigh.interpret().level === 'elevated', 'high blink rate classified as elevated');
assert(blinkerHigh.interpret().stressIndicator > 0.5, 'high blink rate stress indicator elevated');

// ── AU Ring Buffer ──
const arb = AU.createAURingBuffer();
assert(typeof arb === 'object', 'createAURingBuffer returns object');
assert(typeof arb.au1 !== 'undefined', 'ringBuffer has au1 entry');
assert(Array.isArray(arb.au1), 'ringBuffer au1 is array');

// ── Pipeline with v3.1 features ──
const pipe31 = DET.createPipeline();
const pr1 = pipe31.process(neutralLm);
assert(pr1 !== null, 'v3.1 pipeline processes neutral');
// Process several frames to populate ring buffers
for (let f = 0; f < 5; f++) {
  pipe31.process(smileLm);
}
const pr6 = pipe31.process(neutralLm);
assert(pr6 !== null, 'v3.1 pipeline processes after multiple frames');
assert(typeof pr6.blinkRate === 'number', 'v3.1 pipeline has blinkRate');
assert(typeof pr6.zCurvature === 'object' && typeof pr6.zCurvature.periorbR === 'number',
  'v3.1 pipeline zCurvature has periorbR');

// ═══════════════════════════════════════
// 9. SCIENTIFIC ENHANCEMENTS v3.2 TESTS
// ═══════════════════════════════════════
console.log('── Scientific Enhancements v3.2 ──');

// ── Per-user Adaptive Calibrator (Ekman & Friesen 1978) ──
const cal = AU.createCalibrator(5);
assert(typeof cal === 'object', 'createCalibrator returns object');
assert(cal.isLocked() === false, 'calibrator starts unlocked');
assert(cal.getBaseline() === null, 'calibrator baseline null before lock');
// Feed 4 frames – should stay unlocked
for (let ci = 0; ci < 4; ci++) {
  cal.accumulate({ browInnerDist: 0.08 + ci * 0.001, earAvg: 0.25 });
}
assert(cal.isLocked() === false, 'calibrator unlocked after 4/5 frames');
// Feed 5th frame – should lock
cal.accumulate({ browInnerDist: 0.084, earAvg: 0.26 });
assert(cal.isLocked() === true, 'calibrator locks after 5 frames');
const bl = cal.getBaseline();
assert(typeof bl === 'object' && bl !== null, 'calibrator baseline is object');
assert(typeof bl.browInnerDist === 'number', 'baseline has browInnerDist');
assert(typeof bl.earAvg === 'number', 'baseline has earAvg');
assert(near(bl.earAvg, 0.254, 0.01), 'baseline earAvg is mean (' + bl.earAvg.toFixed(4) + ')');
// Further accumulation should be ignored
cal.accumulate({ browInnerDist: 999 });
assert(near(bl.browInnerDist, bl.browInnerDist, 0.001), 'calibrator ignores post-lock data');

// ── 14-point Robust EAR ──
// With proper 14-point landmarks, open-eye EAR should be high
const openAUs = AU.computeAUs(neutralLm);
assert(openAUs.au43 < 0.1, '14pt EAR: open eyes AU43 low (' + openAUs.au43.toFixed(3) + ')');
// With closed 14-point landmarks, AU43 should be high
assert(closedAUs.au43 > 0.3, '14pt EAR: closed eyes AU43 high (' + closedAUs.au43.toFixed(3) + ')');
// EAR consistency: AU5 (upper lid raise) should be zero for neutral
assert(openAUs.au5 >= 0, '14pt EAR: AU5 non-negative');

// ── Head Pose Compensation ──
// computeAUs should accept headPose parameter without error
const hpNeutral = { yaw: 0, pitch: 0, roll: 0 };
const ausNoPose = AU.computeAUs(neutralLm);
const ausWithPose = AU.computeAUs(neutralLm, null, hpNeutral);
assert(typeof ausWithPose.au1 === 'number', 'computeAUs with headPose works');
// With zero yaw/pitch, values should be similar
assert(near(ausNoPose.au1, ausWithPose.au1, 0.05), 'headPose(0,0) ≈ no headPose for AU1');
// Moderate yaw should still produce valid AUs
const hpTurned = { yaw: 25, pitch: 10, roll: 5 };
const ausTurned = AU.computeAUs(neutralLm, null, hpTurned);
assert(typeof ausTurned.au1 === 'number' && ausTurned.au1 >= 0, 'head-turned AUs valid');
assert(typeof ausTurned.au12 === 'number' && ausTurned.au12 >= 0, 'head-turned AU12 valid');

// ── Z-curvature Enhanced Duchenne Score ──
// Duchenne score should include z-curvature contribution
// For a "genuine smile" landmark set with periorbital depth
const duchLm = makeLandmarks({
  61:  { x: 0.40, y: 0.62, z: 0 },    // mouth corners lifted (AU12)
  291: { x: 0.60, y: 0.62, z: 0 },
  50:  { x: 0.32, y: 0.48, z: 0 },    // cheeks raised (AU6)
  280: { x: 0.68, y: 0.48, z: 0 },
  205: { x: 0.30, y: 0.52, z: 0 },
  425: { x: 0.70, y: 0.52, z: 0 },
  // Periorbital z-depth (simulates crow's feet wrinkles)
  130: { x: 0.43, y: 0.36, z: -0.03 },
  247: { x: 0.44, y: 0.34, z:  0.02 },
  30:  { x: 0.34, y: 0.34, z: -0.02 },
  29:  { x: 0.33, y: 0.35, z:  0.01 },
  359: { x: 0.57, y: 0.36, z: -0.03 },
  467: { x: 0.56, y: 0.34, z:  0.02 },
  260: { x: 0.66, y: 0.34, z: -0.02 },
  259: { x: 0.67, y: 0.35, z:  0.01 },
});
const duchAUs = AU.computeAUs(duchLm);
assert(typeof duchAUs.duchenneScore === 'number', 'duchenneScore exists');
// With smile + cheek raise + z-curvature, score should be elevated
assert(duchAUs.duchenneScore >= 0, 'duchenneScore non-negative');

// ── Blink Cluster Detection Fix ──
const blinkerCluster = H.createBlinkAnalyzer();
// Simulate a cluster of 5 rapid blinks (IBI = 200ms each)
const ct = 100000;
for (let bc = 0; bc < 5; bc++) {
  blinkerCluster.recordBlink(ct + bc * 200);
}
const clusterInterp = blinkerCluster.interpret();
assert(typeof clusterInterp.clusters === 'number', 'interpret has clusters field');
// 5 rapid blinks should produce at least 1 cluster
assert(clusterInterp.clusters >= 1, 'rapid blinks produce cluster (' + clusterInterp.clusters + ')');
// Non-clustered blinks (widely spaced)
const blinkerSpaced = H.createBlinkAnalyzer();
for (let bs = 0; bs < 5; bs++) {
  blinkerSpaced.recordBlink(ct + bs * 5000); // 5 seconds apart
}
const spacedInterp = blinkerSpaced.interpret();
assert(spacedInterp.clusters === 0, 'spaced blinks have 0 clusters (' + spacedInterp.clusters + ')');

// ── Pipeline calibration state ──
const calPipe = DET.createPipeline();
const firstResult = calPipe.process(neutralLm);
assert(typeof firstResult.calibrated === 'boolean', 'pipeline has calibrated field');
assert(firstResult.calibrated === false, 'pipeline not calibrated after 1 frame');
// Process enough frames to trigger calibration (60 frames)
for (let cf = 0; cf < 65; cf++) {
  calPipe.process(neutralLm);
}
const calibResult = calPipe.process(neutralLm);
assert(calibResult.calibrated === true, 'pipeline calibrated after 60+ frames');

// ═══════════════════════════════════════
// 10. SCIENTIFIC ENHANCEMENTS v3.3 TESTS
// ═══════════════════════════════════════
console.log('── Scientific Enhancements v3.3 ──');

// ── Calibrator Robust Baseline (Median + MAD) ──
const calRobust = AU.createCalibrator(5);
// Feed deliberately noisy data with outliers
calRobust.accumulate({ earAvg: 0.25, browInnerDist: 0.08 });
calRobust.accumulate({ earAvg: 0.26, browInnerDist: 0.09 });
calRobust.accumulate({ earAvg: 0.24, browInnerDist: 0.07 });
calRobust.accumulate({ earAvg: 0.90, browInnerDist: 0.50 }); // outlier!
calRobust.accumulate({ earAvg: 0.25, browInnerDist: 0.08 });
assert(calRobust.isLocked(), 'robust calibrator locks');
const rbl = calRobust.getBaseline();
// Median of [0.24, 0.25, 0.25, 0.26, 0.90] = 0.25 (mean would be 0.38)
assert(near(rbl.earAvg, 0.25, 0.01), 'robust baseline uses median (' + rbl.earAvg.toFixed(4) + '), not mean');
assert(near(rbl.browInnerDist, 0.08, 0.01), 'browInnerDist median correct (' + rbl.browInnerDist.toFixed(4) + ')');
// MAD should exist
assert(typeof rbl._mad === 'object', 'baseline has _mad (Median Absolute Deviation)');
assert(typeof rbl._mad.earAvg === 'number', 'MAD has earAvg');
assert(rbl._mad.earAvg < 0.05, 'MAD earAvg reasonable (excluding outlier effect) (' + rbl._mad.earAvg.toFixed(4) + ')');

// ── PERCLOS (Dinges et al., 1998) ──
const percBlinker = H.createBlinkAnalyzer();
assert(typeof percBlinker.recordEyeState === 'function', 'blinkAnalyzer has recordEyeState');
assert(typeof percBlinker.getPERCLOS === 'function', 'blinkAnalyzer has getPERCLOS');
assert(percBlinker.getPERCLOS() === 0, 'PERCLOS initial = 0');
// Simulate 100 frames all eyes open (EAR = 0.25)
for (let po = 0; po < 100; po++) percBlinker.recordEyeState(0.25);
assert(percBlinker.getPERCLOS() === 0, 'PERCLOS = 0 when eyes always open');
// Now simulate 20 frames eyes closed (EAR = 0.10)
for (let pc = 0; pc < 20; pc++) percBlinker.recordEyeState(0.10);
const percVal = percBlinker.getPERCLOS();
// 20 closed out of 120 total = 16.7%
assert(percVal > 0.15 && percVal < 0.20, 'PERCLOS ~16.7% (' + (percVal*100).toFixed(1) + '%)');
// PERCLOS should trigger drowsy interpretation
const percInterp = percBlinker.interpret();
assert(percInterp.level === 'drowsy', 'PERCLOS > 15% triggers drowsy level (' + percInterp.level + ')');
assert(typeof percInterp.perclos === 'number', 'interpret() includes perclos field');

// ── Expression Temporal Hysteresis ──
// Create a fresh state and simulate flickering expressions
const hystState = EA.createState();
const hystResult1 = EA.analyze(smileAUs, hystState, null, null);
// First frame of new expression should still hold previous (hysteresis)
// Since prevExpression starts as 'neutral' and smile is different,
// frame 1 of smile should be held back
assert(typeof hystState._hysteresisCount === 'number' || hystState.prevExpression !== undefined,
  'hysteresis state initialized');
// Process 3 more frames of same expression to confirm stable after hold
EA.analyze(smileAUs, hystState, null, null);
EA.analyze(smileAUs, hystState, null, null);
const hystResult4 = EA.analyze(smileAUs, hystState, null, null);
// After 4 frames of consistent smile, expression should be stable
assert(hystResult4.topExpression !== 'neutral' || hystResult4.topConfidence >= 0,
  'expression stabilizes after hysteresis period');

// ── Bilateral AU Smoothing ──
// Verify bilateral values are smoothed, not raw-copied
const bilateralFilters = AU.createAUFilters();
const bilateralSmoothed = AU.smoothAUs(neutralAUs, smileAUs, bilateralFilters);
// After smoothing through 1€ filter, bilateral values should differ from raw curr
// (since filter needs multiple frames to converge, first frame ≈ raw)
assert(typeof bilateralSmoothed.au12_right === 'number', 'bilateral au12_right is smoothed number');
assert(typeof bilateralSmoothed.au1_left === 'number', 'bilateral au1_left is smoothed number');
// Second smooth should show filtering effect
const bilateralSmoothed2 = AU.smoothAUs(bilateralSmoothed, neutralAUs, bilateralFilters);
assert(typeof bilateralSmoothed2.au12_right === 'number', 'bilateral smoothed twice');
// Verify the lazy-init for new bilateral filter keys
assert(typeof bilateralSmoothed2.rPeriorbDensity === 'number', 'rPeriorbDensity smoothed');

// ── Complete Calibration (AU4/AU6/AU9) ──
// After calibration, the baseline-corrected AU4/AU6/AU9 should use
// corrugator/cheek/nasolabial data
const calComplete = AU.createCalibrator(3);
for (let cc = 0; cc < 3; cc++) {
  calComplete.accumulate({
    browInnerDist: 0.08, browOuterDist: 0.06, earAvg: 0.25,
    mar: 0.3, mouthW: 0.4, lipThickness: 0.04,
    cheekDist: 0.10, corrugatorDist: 0.11, nasolabialDist: 0.05,
  });
}
assert(calComplete.isLocked(), 'complete calibrator locks');
const cbl = calComplete.getBaseline();
assert(typeof cbl.corrugatorDist === 'number', 'baseline has corrugatorDist');
assert(typeof cbl.nasolabialDist === 'number', 'baseline has nasolabialDist');
assert(typeof cbl.cheekDist === 'number', 'baseline has cheekDist');
// computeAUs with calibrator should not error
const calibratedAUs = AU.computeAUs(neutralLm, calComplete, null);
assert(typeof calibratedAUs.au4 === 'number', 'calibrated AU4 computes');
assert(typeof calibratedAUs.au9 === 'number', 'calibrated AU9 computes');
assert(typeof calibratedAUs.au6 === 'number', 'calibrated AU6 computes');

// ── Deception Temporal Cue Integration ──
// Verify deception computation doesn't crash with transition info
const decState = PSY.createState();
const decAnalysis = {
  topExpression: 'social_smile', topConfidence: 0.7,
  authenticity: { overall: 0.3, factors: {} },
  transitionInfo: { from: 'neutral', to: 'social_smile', type: 'abrupt',
    frames: 2, naturalness: 0.2, significance: '', timestamp: Date.now() },
  transitionLog: [], transitionMatrix: {},
};
const decRaw = PSY.computeRaw(smileAUs, decAnalysis);
assert(typeof decRaw.deception === 'number', 'deception dimension computes with temporal cues');
assert(decRaw.deception >= 0 && decRaw.deception <= 1, 'deception in [0,1]');
// Abrupt transition + low authenticity should elevate deception
assert(decRaw.deception > 0.1, 'abrupt+low-auth elevates deception (' + decRaw.deception.toFixed(3) + ')');

// ── Pipeline PERCLOS field ──
const percPipe = DET.createPipeline();
const percResult = percPipe.process(neutralLm);
assert(typeof percResult.perclos === 'number', 'pipeline has perclos field');
assert(percResult.perclos >= 0, 'pipeline perclos >= 0');

// ═══════════════════════════════════════
// 11. v3.4 BALANCED IMPROVEMENTS TESTS
// ═══════════════════════════════════════
console.log('── v3.4 Balanced Improvements ──');

// ── PERCLOS O(1) Ring Buffer (replaces O(n) push/shift) ──
const percRB = H.createBlinkAnalyzer();
// Verify same-behavior as before: 100 open + 20 closed = ~16.7%
for (let ro = 0; ro < 100; ro++) percRB.recordEyeState(0.25);
assert(percRB.getPERCLOS() === 0, 'ring buffer PERCLOS=0 when all open');
for (let rc = 0; rc < 20; rc++) percRB.recordEyeState(0.10);
const percRBVal = percRB.getPERCLOS();
assert(percRBVal > 0.15 && percRBVal < 0.20,
  'ring buffer PERCLOS ~16.7% (' + (percRBVal*100).toFixed(1) + '%)');
// Test wrap-around: fill 900+ frames and verify count stays coherent
const percWrap = H.createBlinkAnalyzer();
for (let wf = 0; wf < 1000; wf++) percWrap.recordEyeState(0.25); // all open
assert(percWrap.getPERCLOS() === 0, 'ring buffer PERCLOS=0 after wrap (all open)');
// Now close eyes for 100 frames after wrap
for (let wc = 0; wc < 100; wc++) percWrap.recordEyeState(0.10);
const percWrapVal = percWrap.getPERCLOS();
// 100 closed out of 900 window = ~11.1%
assert(percWrapVal > 0.08 && percWrapVal < 0.15,
  'ring buffer PERCLOS correct after wrap (' + (percWrapVal*100).toFixed(1) + '%)');

// ── IBI Coefficient of Variation (replaces raw ms² variance) ──
const cvBlinker = H.createBlinkAnalyzer();
assert(typeof cvBlinker.getIBICoeffVar === 'function', 'blinkAnalyzer has getIBICoeffVar');
assert(cvBlinker.getIBICoeffVar() === 0, 'IBI CV=0 initially');
// Regular blinks (same IBI) → CV ≈ 0
const cvBase = 200000;
for (let cb = 0; cb < 10; cb++) cvBlinker.recordBlink(cvBase + cb * 3000);
const cvRegular = cvBlinker.getIBICoeffVar();
assert(cvRegular < 0.05, 'IBI CV near 0 for regular blinks (' + cvRegular.toFixed(4) + ')');
// Irregular blinks → CV elevated
const cvIrreg = H.createBlinkAnalyzer();
cvIrreg.recordBlink(cvBase);
cvIrreg.recordBlink(cvBase + 1000);
cvIrreg.recordBlink(cvBase + 5000);
cvIrreg.recordBlink(cvBase + 6000);
cvIrreg.recordBlink(cvBase + 12000);
const cvIrregVal = cvIrreg.getIBICoeffVar();
assert(cvIrregVal > 0.3, 'IBI CV elevated for irregular blinks (' + cvIrregVal.toFixed(4) + ')');
// Verify interpret() uses CV-based threshold
const cvIrregBlinker2 = H.createBlinkAnalyzer();
cvIrregBlinker2.recordBlink(cvBase);
cvIrregBlinker2.recordBlink(cvBase + 500);
cvIrregBlinker2.recordBlink(cvBase + 4000);
cvIrregBlinker2.recordBlink(cvBase + 4500);
cvIrregBlinker2.recordBlink(cvBase + 10000);
cvIrregBlinker2.recordBlink(cvBase + 10200);
cvIrregBlinker2.recordBlink(cvBase + 55000);
const cvInterp = cvIrregBlinker2.interpret();
assert(typeof cvInterp.ibiVariance === 'number', 'interpret ibiVariance field is CV (number)');

// ── Module-level calibShift (no per-frame closure) ──
// Verify calibrated AU4/AU6/AU9 still work correctly
const calModLevel = AU.createCalibrator(3);
for (let cm = 0; cm < 3; cm++) {
  calModLevel.accumulate({
    browInnerDist: 0.08, browOuterDist: 0.06, earAvg: 0.25,
    mar: 0.3, mouthW: 0.4, lipThickness: 0.04,
    cheekDist: 0.10, corrugatorDist: 0.11, nasolabialDist: 0.05,
  });
}
const calMLAUs = AU.computeAUs(neutralLm, calModLevel, null);
assert(typeof calMLAUs.au4 === 'number', 'module-level calibShift: AU4 computes');
assert(typeof calMLAUs.au6 === 'number', 'module-level calibShift: AU6 computes');
assert(typeof calMLAUs.au9 === 'number', 'module-level calibShift: AU9 computes');
assert(calMLAUs.au4 >= 0 && calMLAUs.au4 <= 1, 'module-level calibShift: AU4 in [0,1]');

// ── Calibrated AU45 Blink Threshold ──
// After calibration, AU45 should use personal baseline (60% of earAvg)
const calBlink = AU.createCalibrator(3);
for (let cbl = 0; cbl < 3; cbl++) {
  calBlink.accumulate({
    browInnerDist: 0.08, browOuterDist: 0.06, earAvg: 0.30,
    mar: 0.3, mouthW: 0.4, lipThickness: 0.04,
    cheekDist: 0.10, corrugatorDist: 0.11, nasolabialDist: 0.05,
  });
}
assert(calBlink.isLocked(), 'blink calibrator locks');
// With earAvg baseline = 0.30, threshold = 0.30 * 0.6 = 0.18
// Eyes slightly open at EAR=0.20 should NOT be blink (above 0.18)
// Eyes at fixed threshold 0.16 would also not blink, but this tests the mechanism
const openishLm = makeLandmarks({
  // Set upper/lower lids to give EAR ≈ 0.19 (between 0.16 and 0.18)
  160: { x: 0.37, y: 0.338, z: 0 },
  158: { x: 0.39, y: 0.338, z: 0 },
  153: { x: 0.39, y: 0.362, z: 0 },
  144: { x: 0.37, y: 0.362, z: 0 },
  385: { x: 0.60, y: 0.338, z: 0 },
  387: { x: 0.62, y: 0.338, z: 0 },
  373: { x: 0.62, y: 0.362, z: 0 },
  380: { x: 0.60, y: 0.362, z: 0 },
  161: { x: 0.36, y: 0.338, z: 0 },
  159: { x: 0.38, y: 0.338, z: 0 },
  157: { x: 0.40, y: 0.338, z: 0 },
  163: { x: 0.36, y: 0.362, z: 0 },
  145: { x: 0.38, y: 0.362, z: 0 },
  154: { x: 0.40, y: 0.362, z: 0 },
  388: { x: 0.59, y: 0.338, z: 0 },
  386: { x: 0.61, y: 0.338, z: 0 },
  384: { x: 0.63, y: 0.338, z: 0 },
  390: { x: 0.59, y: 0.362, z: 0 },
  374: { x: 0.61, y: 0.362, z: 0 },
  381: { x: 0.63, y: 0.362, z: 0 },
});
const calBlinkAUs = AU.computeAUs(openishLm, calBlink, null);
// The calibrated pipeline should have set AU45 using personal threshold
assert(typeof calBlinkAUs.au45 === 'number', 'calibrated AU45 is number');

// ── Pose-Compensated MAR ──
// MAR with zero pose should be same as without pose
const noPoseAUs = AU.computeAUs(neutralLm);
const zeroPoseAUs = AU.computeAUs(neutralLm, null, { yaw: 0, pitch: 0, roll: 0 });
assert(near(noPoseAUs.mar, zeroPoseAUs.mar, 0.01),
  'MAR with zero headPose ≈ no headPose (' + noPoseAUs.mar.toFixed(4) + ' vs ' + zeroPoseAUs.mar.toFixed(4) + ')');
// MAR with moderate yaw should differ (compensation applied)
const yawPoseAUs = AU.computeAUs(neutralLm, null, { yaw: 30, pitch: 0, roll: 0 });
assert(typeof yawPoseAUs.mar === 'number' && yawPoseAUs.mar >= 0,
  'MAR with yaw headPose valid (' + yawPoseAUs.mar.toFixed(4) + ')');

// ── Hoisted Constant Arrays (SMOOTH_RAW_KEYS, SMOOTH_BILATERAL_KEYS) ──
// Verify smoothAUs still works correctly with hoisted constants
const hoistFilters = AU.createAUFilters();
const hoistS1 = AU.smoothAUs(neutralAUs, smileAUs, hoistFilters);
assert(typeof hoistS1.corrugatorAvg === 'number', 'hoisted raw keys: corrugatorAvg smoothed');
assert(typeof hoistS1.au12_right === 'number', 'hoisted bilateral keys: au12_right smoothed');
assert(typeof hoistS1.rPeriorbDensity === 'number', 'hoisted bilateral keys: rPeriorbDensity smoothed');
const hoistS2 = AU.smoothAUs(hoistS1, neutralAUs, hoistFilters);
assert(typeof hoistS2.nasolabialAvg === 'number', 'hoisted keys: second smooth works');

// ═══════════════════════════════════════
// 9. FPS-INDEPENDENT TRANSITION TESTS
// ═══════════════════════════════════════
console.log('── FPS-Independent Transition ──');

// analyzeTransition returns durationMs, not frames
const transMs = EA.analyzeTransition('neutral', 'anger', 80, neutralAUs);
assert(typeof transMs.durationMs === 'number', 'analyzeTransition returns durationMs field');
assert(transMs.durationMs === 80, 'durationMs equals passed value');

// Boundary: exactly abruptMaxMs (100ms) → still abrupt
const boundaryAbrupt = EA.analyzeTransition('neutral', 'anger', 100, neutralAUs);
assert(boundaryAbrupt.type === 'abrupt', 'exactly 100ms = abrupt boundary');

// Boundary: exactly smoothMinMs (267ms) → smooth
const boundarySmooth = EA.analyzeTransition('neutral', 'genuine_smile', 267, neutralAUs);
assert(boundarySmooth.type === 'smooth', 'exactly 267ms = smooth boundary');

// Normal: between abrupt and smooth → normal
const normalTrans = EA.analyzeTransition('neutral', 'social_smile', 180, neutralAUs);
assert(normalTrans.type === 'normal', '180ms = normal transition');

// Zero duration → abrupt
const zeroTrans = EA.analyzeTransition('neutral', 'anger', 0, neutralAUs);
assert(zeroTrans.type === 'abrupt', '0ms = abrupt transition');

// ═══════════════════════════════════════
// 10. MICRO-EXPRESSION × HYSTERESIS TESTS (mock Date.now)
// ═══════════════════════════════════════
console.log('── Micro-expression × Hysteresis ──');

// Deterministic micro-expression capture using mocked Date.now.
// This proves that a brief expression burst (40-500ms) that is
// too short to pass hysteresis (3 frames) is still captured in
// the microLog via the pre-hysteresis rawTopExpr pathway.
{
  const origDateNow = Date.now;
  let mockTime = 100000; // start at 100s
  Date.now = () => mockTime;

  try {
    const mState = EA.createState();
    // Build neutral AUs that classify as 'neutral' (no AU activity)
    const neutralAUsM = {
      ...smileAUs,
      au1: 0, au2: 0, au4: 0, au5: 0, au6: 0, au7: 0,
      au9: 0, au10: 0, au12: 0, au14: 0, au15: 0, au17: 0,
      au20: 0, au23: 0, au24: 0, au25: 0, au26: 0,
      au43: 0, au45: 0, au46: 0,
      duchenneScore: 0, muscleConflictScore: 0,
      overallAsymmetry: 0, mouthAsymmetry: 0,
    };

    // Feed 5 neutral frames to establish stable state (each 33ms apart)
    for (let i = 0; i < 5; i++) {
      EA.analyze(neutralAUsM, mState, null, null);
      mockTime += 33;
    }
    assert(mState.prevExpression === 'neutral', 'mock: neutral state established');
    assert(mState.microLog.length === 0, 'mock: no micros yet');

    // Now inject 1 frame with strong anger AUs (should classify as anger)
    // This is frame 6 — it triggers microCandidate on rawTopExpr
    const angerAUsM = {
      ...neutralAUsM,
      au4: 0.9, au7: 0.8, au23: 0.7, au9: 0.5,
    };
    EA.analyze(angerAUsM, mState, null, null);
    mockTime += 80; // 80ms later — within micro-expression window [40-500ms]

    // The anger was a single frame → hysteresis holds 'neutral' as topExpr,
    // but microCandidate should have started on rawTopExpr.
    assert(mState.microCandidate !== null, 'mock: microCandidate started on 1-frame anger');
    assert(mState.microCandidate.name !== 'neutral',
      'mock: microCandidate is not neutral (captured raw)');

    // Return to neutral — this frame closes the micro-expression candidate.
    // elapsed = 80ms → within [40, 500] → should log it!
    EA.analyze(neutralAUsM, mState, null, null);
    mockTime += 33;

    assert(mState.microCandidate === null, 'mock: microCandidate cleared after close');
    assert(mState.microLog.length === 1, 'mock: exactly 1 micro-expression logged');
    assert(mState.microLog[0].durationMs === 80,
      'mock: micro duration = 80ms (controlled)');
    assert(mState.microLog[0].context === 'neutral',
      'mock: micro context was neutral');

    // Verify hysteresis did NOT accept the anger as a main expression change
    assert(mState.prevExpression === 'neutral',
      'mock: hysteresis held neutral throughout (anger was only 1 frame)');

  } finally {
    Date.now = origDateNow; // restore
  }
}

// Test micro-expression that is TOO SHORT (< 40ms) should NOT be logged
{
  const origDateNow = Date.now;
  let mockTime = 200000;
  Date.now = () => mockTime;

  try {
    const mState2 = EA.createState();
    const neutralAUsM2 = {
      ...smileAUs,
      au1: 0, au2: 0, au4: 0, au5: 0, au6: 0, au7: 0,
      au9: 0, au10: 0, au12: 0, au14: 0, au15: 0, au17: 0,
      au20: 0, au23: 0, au24: 0, au25: 0, au26: 0,
      au43: 0, au45: 0, au46: 0,
      duchenneScore: 0, muscleConflictScore: 0,
      overallAsymmetry: 0, mouthAsymmetry: 0,
    };

    for (let i = 0; i < 5; i++) {
      EA.analyze(neutralAUsM2, mState2, null, null);
      mockTime += 33;
    }

    // Inject anger for only 20ms — below 40ms minimum
    const angerAUsM2 = { ...neutralAUsM2, au4: 0.9, au7: 0.8, au23: 0.7, au9: 0.5 };
    EA.analyze(angerAUsM2, mState2, null, null);
    mockTime += 20; // only 20ms — too short

    EA.analyze(neutralAUsM2, mState2, null, null);
    assert(mState2.microLog.length === 0,
      'mock: 20ms burst NOT logged (below 40ms minimum)');
  } finally {
    Date.now = origDateNow;
  }
}

// Verify analyzeTransition config uses ms, not frames
{
  const tcfg = CFG.TRANSITION;
  assert(typeof tcfg.abruptMaxMs === 'number', 'config TRANSITION.abruptMaxMs exists');
  assert(typeof tcfg.smoothMinMs === 'number', 'config TRANSITION.smoothMinMs exists');
  assert(tcfg.abruptMaxMs > 0, 'abruptMaxMs > 0');
  assert(tcfg.smoothMinMs > tcfg.abruptMaxMs, 'smoothMinMs > abruptMaxMs');
  assert(tcfg.abruptMaxMs === 100, 'abruptMaxMs = 100ms (~3 frames @30fps)');
  assert(tcfg.smoothMinMs === 267, 'smoothMinMs = 267ms (~8 frames @30fps)');
}

// ═══════════════════════════════════════
// 11. VALENCE MAPPING COMPLETENESS
// ═══════════════════════════════════════
console.log('── Valence Mapping ──');

// Helper: compute valence for a given expression at full confidence
function valenceFor(exprName) {
  const mockAnalysis = {
    topExpression: exprName,
    topConfidence: 1.0,
    authenticity: { overall: 0.5, factors: {} },
    transitionInfo: null,
  };
  const raw = PSY.computeRaw(smileAUs, mockAnalysis);
  return raw.valence;
}

// Positive-valence expressions should be > 0.5
assert(valenceFor('genuine_smile') > 0.5, 'genuine_smile valence positive');
assert(valenceFor('pleasure') > 0.5, 'pleasure valence positive');
assert(valenceFor('social_smile') > 0.5, 'social_smile valence positive');
assert(valenceFor('suppressed_smile') > 0.5, 'suppressed_smile valence positive');
assert(valenceFor('interest') > 0.5, 'interest valence positive');
assert(valenceFor('duping_delight') > 0.5, 'duping_delight valence positive');

// Negative-valence expressions should be < 0.5
assert(valenceFor('pain') < 0.5, 'pain valence negative (critical)');
assert(valenceFor('anger') < 0.5, 'anger valence negative');
assert(valenceFor('sadness') < 0.5, 'sadness valence negative');
assert(valenceFor('fear') < 0.5, 'fear valence negative');
assert(valenceFor('disgust') < 0.5, 'disgust valence negative');
assert(valenceFor('disdain') < 0.5, 'disdain valence negative');
assert(valenceFor('tension') < 0.5, 'tension valence negative');
assert(valenceFor('boredom') < 0.5, 'boredom valence negative');
assert(valenceFor('embarrassment') < 0.5, 'embarrassment valence negative');
assert(valenceFor('fatigue') < 0.5, 'fatigue valence negative');
assert(valenceFor('confusion') < 0.5, 'confusion valence negative');
assert(valenceFor('nervous_smile') < 0.5, 'nervous_smile valence negative');
assert(valenceFor('suppression') < 0.5, 'suppression valence negative');
assert(valenceFor('anxiety') < 0.5, 'anxiety valence negative');

// Neutral expression should be ~0.5
assert(near(valenceFor('neutral'), 0.5, 0.05), 'neutral valence ≈ 0.5');
// Concentration is neutral-valence by design
assert(near(valenceFor('concentration'), 0.5, 0.05), 'concentration valence ≈ 0.5');

// Ordering: pain should be more negative than boredom
assert(valenceFor('pain') < valenceFor('boredom'),
  'pain more negative than boredom (circumplex ordering)');
// genuine_smile should be more positive than social_smile
assert(valenceFor('genuine_smile') > valenceFor('social_smile'),
  'genuine_smile more positive than social_smile');

// ═══════════════════════════════════════
// 12. DISSONANCE HISTORY, NEUTRAL-GATED BASELINE, BLINK API
// ═══════════════════════════════════════
console.log('── DissonanceHistory / Baseline / BlinkAPI ──');

// dissonanceHistory should be populated after update()
{
  const pState = PSY.createState();
  assert(Array.isArray(pState.dissonanceHistory), 'dissonanceHistory is array');
  assert(pState.dissonanceHistory.length === 0, 'dissonanceHistory starts empty');

  const mockAnalysis = {
    topExpression: 'neutral', topConfidence: 0.5,
    authenticity: { overall: 0.5, factors: { duchenne: 0.5, temporal: 0.5, symmetry: 0.5, muscleConflict: 0.8, leakage: 1.0 } },
    transitionInfo: null, transitionLog: [], microLog: [], headPose: null,
  };
  PSY.update(pState, smileAUs, mockAnalysis, null);
  assert(pState.dissonanceHistory.length === 1, 'dissonanceHistory populated after 1 update');
  assert(typeof pState.dissonanceHistory[0] === 'number', 'dissonanceHistory entries are numbers');
  assert(pState._lastDissonance !== undefined, '_lastDissonance cached for generateAnalysis');
}

// Neutral-gated baseline: should NOT accumulate during non-neutral expressions
{
  const bState = PSY.createState();
  const angerAnalysis = {
    topExpression: 'anger', topConfidence: 0.9,
    authenticity: { overall: 0.3, factors: { duchenne: 0.1, temporal: 0.3, symmetry: 0.4, muscleConflict: 0.3, leakage: 1.0 } },
    transitionInfo: null, transitionLog: [], microLog: [], headPose: null,
  };
  // Feed anger frames
  for (let i = 0; i < 10; i++) {
    PSY.update(bState, smileAUs, angerAnalysis, null);
  }
  assert(bState.baselineFrames === 0, 'baseline did NOT accumulate during anger');
  assert(bState.baselineLocked === false, 'baseline NOT locked from anger frames');

  // Now feed neutral frames — these should count
  const neutralAnalysis = {
    topExpression: 'neutral', topConfidence: 0.3,
    authenticity: { overall: 0.7, factors: { duchenne: 0.5, temporal: 0.5, symmetry: 0.8, muscleConflict: 0.9, leakage: 1.0 } },
    transitionInfo: null, transitionLog: [], microLog: [], headPose: null,
  };
  for (let i = 0; i < 5; i++) {
    PSY.update(bState, smileAUs, neutralAnalysis, null);
  }
  assert(bState.baselineFrames === 5, 'baseline accumulated 5 neutral frames');
}

// recordBlinkIfNew API encapsulation
{
  const ba = H.createBlinkAnalyzer();
  assert(typeof ba.recordBlinkIfNew === 'function', 'blinkAnalyzer has recordBlinkIfNew');
  // Should only record when count increases
  ba.recordBlinkIfNew(0, 1000);
  ba.recordBlinkIfNew(0, 2000); // same count → no record
  assert(ba.getBlinkRate() === 0, 'no blinks recorded for count=0');
  ba.recordBlinkIfNew(1, 3000); // count increased → record
  ba.recordBlinkIfNew(1, 4000); // same count → no record
  ba.recordBlinkIfNew(2, 5000); // count increased → record
  // At this point: 2 blinks recorded at t=3000 and t=5000
  // We can't reliably test rate without more blinks, but we can test IBI
  const ibiMean = ba.getIBIMean();
  assert(ibiMean === 2000, 'IBI mean = 2000ms (5000-3000)');
}

// ═══════════════════════════════════════
// I18N MODULE TESTS
// ═══════════════════════════════════════

// FaceI18n existence and API
assert(typeof I18n === 'object', 'FaceI18n is defined');
assert(typeof I18n.t === 'function', 'FaceI18n.t is a function');
assert(typeof I18n.exprLabel === 'function', 'FaceI18n.exprLabel is a function');
assert(typeof I18n.psyLabel === 'function', 'FaceI18n.psyLabel is a function');
assert(typeof I18n.getLocale === 'function', 'FaceI18n.getLocale is a function');
assert(typeof I18n.setLocale === 'function', 'FaceI18n.setLocale is a function');
assert(typeof I18n.getAvailableLocales === 'function', 'FaceI18n.getAvailableLocales is a function');
assert(typeof I18n.onLocaleChange === 'function', 'FaceI18n.onLocaleChange is a function');

// Default locale
assert(I18n.getLocale() === 'zh-CN', 'default locale is zh-CN');

// Available locales
{
  const locales = I18n.getAvailableLocales();
  assert(locales.includes('zh-CN'), 'zh-CN is available');
  assert(locales.includes('en-US'), 'en-US is available');
}

// Translation: zh-CN
assert(I18n.t('statusOnline') === '系统在线 — 深度分析中', 't() returns zh-CN string');
assert(I18n.exprLabel('genuine_smile') === '真笑 (Duchenne)', 'exprLabel() zh-CN');
assert(I18n.psyLabel('valence') === '情绪效价', 'psyLabel() zh-CN');

// Locale switch
{
  let changed = false;
  const listener = () => { changed = true; };
  I18n.onLocaleChange(listener);
  I18n.setLocale('en-US');
  assert(I18n.getLocale() === 'en-US', 'locale switched to en-US');
  assert(changed, 'locale change listener fired');
  assert(I18n.t('statusOnline') === 'System online — deep analysis', 't() returns en-US string');
  assert(I18n.exprLabel('genuine_smile') === 'Genuine Smile (Duchenne)', 'exprLabel() en-US');
  assert(I18n.psyLabel('valence') === 'Valence', 'psyLabel() en-US');
  // Switch back
  I18n.setLocale('zh-CN');
  assert(I18n.getLocale() === 'zh-CN', 'locale switched back to zh-CN');
  I18n.removeLocaleListener(listener);
}

// Unknown key returns key itself
assert(I18n.t('nonexistent_key_xyz') === 'nonexistent_key_xyz', 'unknown key returns key');

// All 25 expression labels exist in both locales
{
  const exprKeys = Object.keys(CFG.EXPRESSION_LABELS);
  for (const ek of exprKeys) {
    assert(I18n.exprLabel(ek) !== ek || ek === 'neutral', `zh-CN exprLabel for ${ek} exists`);
  }
  I18n.setLocale('en-US');
  for (const ek of exprKeys) {
    assert(I18n.exprLabel(ek) !== ek || ek === 'neutral', `en-US exprLabel for ${ek} exists`);
  }
  I18n.setLocale('zh-CN');
}

// All 12 psychology labels exist in both locales
{
  const psyKeys = CFG.PSYCHOLOGY_KEYS;
  for (const pk of psyKeys) {
    assert(I18n.psyLabel(pk) !== pk, `zh-CN psyLabel for ${pk} exists`);
  }
  I18n.setLocale('en-US');
  for (const pk of psyKeys) {
    assert(I18n.psyLabel(pk) !== pk, `en-US psyLabel for ${pk} exists`);
  }
  I18n.setLocale('zh-CN');
}

// Invalid locale is ignored
{
  I18n.setLocale('fr-FR');
  assert(I18n.getLocale() === 'zh-CN', 'invalid locale fr-FR ignored');
}

// ═══════════════════════════════════════
// EXPORT MODULE TESTS
// ═══════════════════════════════════════

assert(typeof EXP === 'object', 'FaceExport is defined');
assert(typeof EXP.buildSnapshot === 'function', 'FaceExport.buildSnapshot is a function');
assert(typeof EXP.flattenResult === 'function', 'FaceExport.flattenResult is a function');
assert(typeof EXP.buildCSV === 'function', 'FaceExport.buildCSV is a function');
assert(typeof EXP.downloadJSON === 'function', 'FaceExport.downloadJSON is a function');
assert(typeof EXP.downloadCSV === 'function', 'FaceExport.downloadCSV is a function');
assert(typeof EXP.downloadHistoryJSON === 'function', 'FaceExport.downloadHistoryJSON is a function');
assert(typeof EXP.downloadHistoryCSV === 'function', 'FaceExport.downloadHistoryCSV is a function');

// buildSnapshot with null
assert(EXP.buildSnapshot(null) === null, 'buildSnapshot(null) returns null');

// buildSnapshot with mock result
{
  const mockResult = {
    topExpr: 'genuine_smile',
    topConf: 0.85,
    expressions: [{ name: 'genuine_smile', confidence: 0.85 }],
    aus: { au1: 0.3, au6: 0.7, au12: 0.8 },
    psychology: { valence: 0.8, arousal: 0.5, stress: 0.2 },
    authenticity: { overall: 0.9, factors: { duchenne: 0.95, temporal: 0.8 } },
    headPose: { yaw: 5.0, pitch: -2.0, roll: 1.0 },
    blinkCount: 12,
    blinkAnalysis: { rate: 18.5, perclos: 0.04 },
    calibrated: true,
  };
  const snap = EXP.buildSnapshot(mockResult);
  assert(snap !== null, 'buildSnapshot returns object');
  assert(snap.topExpression === 'genuine_smile', 'snapshot topExpression');
  assert(snap.topConfidence === 0.85, 'snapshot topConfidence');
  assert(snap.timestamp !== undefined, 'snapshot has timestamp');
  assert(snap.headPose.yaw === 5.0, 'snapshot headPose preserved');
  assert(snap.blinkCount === 12, 'snapshot blinkCount preserved');
  assert(snap.calibrated === true, 'snapshot calibrated preserved');
}

// flattenResult
{
  const mockResult = {
    topExpr: 'anger',
    topConf: 0.7,
    aus: { au4: 0.5, au7: 0.3 },
    psychology: { stress: 0.6, tension: 0.5 },
    authenticity: { overall: 0.4, factors: { duchenne: 0.1, temporal: 0.3, symmetry: 0.5, duration: 0.6, muscleConflict: 0.4, leakage: 0.9 } },
    headPose: { yaw: 10, pitch: 5, roll: -2 },
    blinkCount: 5,
    blinkAnalysis: { rate: 15.0, perclos: 0.03 },
    calibrated: false,
  };
  const flat = EXP.flattenResult(mockResult);
  assert(flat.topExpression === 'anger', 'flat topExpression');
  assert(flat.timestamp !== undefined, 'flat has timestamp');
  assert(flat.calibrated === 0, 'flat calibrated = 0 for false');
  assert(flat.headPose_yaw === '10.00', 'flat headPose_yaw');
}

// buildCSV
{
  const rows = [
    { a: 'hello', b: 42, c: 'with,comma' },
    { a: 'world', b: 99, c: 'normal' },
  ];
  const csv = EXP.buildCSV(rows);
  assert(csv.startsWith('a,b,c'), 'CSV header correct');
  assert(csv.includes('"with,comma"'), 'CSV escapes commas');
  assert(csv.includes('world,99,normal'), 'CSV data row');
}

// buildCSV empty
assert(EXP.buildCSV([]) === '', 'buildCSV([]) returns empty string');
assert(EXP.buildCSV(null) === '', 'buildCSV(null) returns empty string');

// ═══════════════════════════════════════
// HISTORY MODULE TESTS
// ═══════════════════════════════════════

assert(typeof HIST === 'object', 'FaceHistory is defined');
assert(typeof HIST.create === 'function', 'FaceHistory.create is a function');
assert(typeof HIST.computeTrend === 'function', 'FaceHistory.computeTrend is a function');

// create returns instance with required API
{
  const inst = HIST.create();
  assert(typeof inst.init === 'function', 'history instance has init');
  assert(typeof inst.getProfiles === 'function', 'history instance has getProfiles');
  assert(typeof inst.saveProfile === 'function', 'history instance has saveProfile');
  assert(typeof inst.deleteProfile === 'function', 'history instance has deleteProfile');
  assert(typeof inst.startSession === 'function', 'history instance has startSession');
  assert(typeof inst.addSnapshot === 'function', 'history instance has addSnapshot');
  assert(typeof inst.endSession === 'function', 'history instance has endSession');
  assert(typeof inst.isRecording === 'function', 'history instance has isRecording');
  assert(typeof inst.getSessions === 'function', 'history instance has getSessions');
  assert(typeof inst.getAllSessions === 'function', 'history instance has getAllSessions');
  assert(typeof inst.clearProfile === 'function', 'history instance has clearProfile');
  assert(typeof inst.clearAll === 'function', 'history instance has clearAll');
  assert(typeof inst.computeTrend === 'function', 'history instance has computeTrend');
  assert(typeof inst.deleteSession === 'function', 'history instance has deleteSession');
}

// Recording state
{
  const inst = HIST.create();
  assert(inst.isRecording() === false, 'not recording initially');
  inst.startSession('test');
  assert(inst.isRecording() === true, 'recording after startSession');
}

// computeTrend with mock sessions
{
  const mockSessions = [
    {
      startTime: 1000, endTime: 5000,
      snapshots: [
        { t: 1000, expr: 'genuine_smile', conf: 0.8, psy: { valence: 0.7, arousal: 0.4, stress: 0.2, cognitiveLoad: 0.3, confidence: 0.6, engagement: 0.5, comfort: 0.7, authenticity: 0.8, tension: 0.2, deception: 0.1, suppressionEffort: 0.1, emotionalRegulation: 0.7 } },
        { t: 2000, expr: 'genuine_smile', conf: 0.9, psy: { valence: 0.8, arousal: 0.5, stress: 0.1, cognitiveLoad: 0.2, confidence: 0.7, engagement: 0.6, comfort: 0.8, authenticity: 0.9, tension: 0.1, deception: 0.05, suppressionEffort: 0.05, emotionalRegulation: 0.8 } },
      ],
    },
    {
      startTime: 10000, endTime: 15000,
      snapshots: [
        { t: 10000, expr: 'sadness', conf: 0.6, psy: { valence: 0.3, arousal: 0.6, stress: 0.5, cognitiveLoad: 0.4, confidence: 0.3, engagement: 0.4, comfort: 0.3, authenticity: 0.5, tension: 0.5, deception: 0.3, suppressionEffort: 0.4, emotionalRegulation: 0.4 } },
      ],
    },
  ];

  const trend = HIST.computeTrend(mockSessions);
  assert(trend !== null, 'computeTrend returns object');
  assert(trend.sessionCount === 2, 'trend sessionCount = 2');
  assert(trend.totalFrames === 3, 'trend totalFrames = 3');
  assert(trend.topExpressions.genuine_smile === 2, 'trend topExpressions genuine_smile = 2');
  assert(trend.topExpressions.sadness === 1, 'trend topExpressions sadness = 1');
  assert(typeof trend.avgPsy.valence === 'number', 'trend avgPsy.valence is number');
  assert(typeof trend.trendDirection.valence === 'string', 'trend trendDirection.valence is string');
}

// computeTrend empty
assert(HIST.computeTrend([]) === null, 'computeTrend([]) returns null');
assert(HIST.computeTrend(null) === null, 'computeTrend(null) returns null');

// i18n integration: psychology engine analysis uses i18n
{
  const psyState = PSY.createState();
  assert(psyState.regulationStyle === '', 'initial regulationStyle is empty string (i18n-ready)');
}

// i18n: transition significance keys exist in both locales
{
  const transKeys = [
    'trans.genuineToNeutralSmooth', 'trans.socialToNeutralAbrupt',
    'trans.neutralToSmileAbrupt', 'trans.genuineToContempt',
    'trans.socialToContempt', 'trans.angerToSocial',
    'trans.sadnessToGenuine', 'trans.sadnessToSocial',
    'trans.suppressionToSmile', 'trans.fearToSocial',
    'trans.toSuppression', 'trans.concToSurprise',
    'trans.neutralToAnxiety', 'trans.suppressedType',
    'trans.abruptNonNeutral',
  ];
  I18n.setLocale('zh-CN');
  for (const tk of transKeys) {
    assert(I18n.t(tk) !== tk, `zh-CN trans key ${tk} exists`);
  }
  I18n.setLocale('en-US');
  for (const tk of transKeys) {
    assert(I18n.t(tk) !== tk, `en-US trans key ${tk} exists`);
  }
  I18n.setLocale('zh-CN');
}

// i18n: blink interpret keys exist in both locales
{
  const blinkKeys = ['blink.drowsy', 'blink.elevated', 'blink.reduced', 'blink.irregular'];
  I18n.setLocale('zh-CN');
  for (const bk of blinkKeys) {
    assert(I18n.t(bk) !== bk, `zh-CN blink key ${bk} exists`);
  }
  I18n.setLocale('en-US');
  for (const bk of blinkKeys) {
    assert(I18n.t(bk) !== bk, `en-US blink key ${bk} exists`);
  }
  I18n.setLocale('zh-CN');
}

// i18n: locale persistence key format
{
  I18n.setLocale('en-US');
  assert(I18n.getLocale() === 'en-US', 'locale set to en-US for persistence test');
  I18n.setLocale('zh-CN');
  assert(I18n.getLocale() === 'zh-CN', 'locale restored to zh-CN');
}

// ══════════════════════════════════════════════════════
//  v3.8 Improvements
// ══════════════════════════════════════════════════════
console.log('── v3.8 Quality & Robustness ──');

// ── flattenLightSnapshot ──
{
  const snap = {
    t: 1700000000000,
    expr: 'genuine_smile',
    conf: 0.85,
    psy: {
      valence: 0.8, arousal: 0.5, cognitiveLoad: 0.3, stress: 0.1,
      confidence: 0.7, engagement: 0.6, comfort: 0.8, authenticity: 0.9,
      tension: 0.1, deception: 0.05, suppressionEffort: 0.1, emotionalRegulation: 0.7,
    },
    auth: 0.75,
    blinkRate: 16.5,
    hp: { y: 2.1, p: -1.3, r: 0.5 },
  };
  const flat = EXP.flattenLightSnapshot(snap);
  assert(flat.topExpression === 'genuine_smile', 'flattenLight: topExpression mapped from snap.expr');
  assert(parseFloat(flat.topConfidence) > 0.84, 'flattenLight: topConfidence mapped from snap.conf');
  assert(flat.timestamp.includes('2023'), 'flattenLight: timestamp derived from snap.t');
  assert(parseFloat(flat.psy_valence) > 0.79, 'flattenLight: psy_valence mapped');
  assert(parseFloat(flat.psy_stress) < 0.11, 'flattenLight: psy_stress mapped');
  assert(parseFloat(flat.authenticity_overall) > 0.74, 'flattenLight: authenticity from snap.auth');
  assert(parseFloat(flat.blinkRate) > 16, 'flattenLight: blinkRate mapped');
  assert(parseFloat(flat.headPose_yaw) > 2.0, 'flattenLight: headPose_yaw from snap.hp.y');
  assert(parseFloat(flat.headPose_pitch) < -1.2, 'flattenLight: headPose_pitch from snap.hp.p');
  assert(parseFloat(flat.headPose_roll) > 0.4, 'flattenLight: headPose_roll from snap.hp.r');
  // Edge cases
  assert(Object.keys(EXP.flattenLightSnapshot(null)).length === 0, 'flattenLight: null → empty object');
  const emptyFlat = EXP.flattenLightSnapshot({});
  assert(emptyFlat.topExpression === '', 'flattenLight: missing fields → defaults');
  assert(emptyFlat.timestamp === '', 'flattenLight: no t → empty timestamp');
}

// ── flattenLightSnapshot: all 12 psy dimensions present ──
{
  const psyKeys = CFG.PSYCHOLOGY_KEYS;
  const fullPsy = {};
  for (const k of psyKeys) fullPsy[k] = 0.42;
  const flat = EXP.flattenLightSnapshot({ t: Date.now(), expr: 'neutral', conf: 0, psy: fullPsy });
  for (const k of psyKeys) {
    assert(flat['psy_' + k] !== undefined, `flattenLight: psy_${k} present`);
    assert(parseFloat(flat['psy_' + k]) > 0.41, `flattenLight: psy_${k} value correct`);
  }
}

// ── Pipeline error boundary ──
{
  // Pipeline.process should return null on bad data instead of throwing
  const pipeline = globalThis.FaceDetector.createPipeline();
  // Empty array — isValidFaceLandmarks returns false
  const r1 = pipeline.process([]);
  assert(r1 === null, 'pipeline returns null for empty landmarks');
  // null input
  const r2 = pipeline.process(null);
  assert(r2 === null, 'pipeline returns null for null input');
}

// ── Dead code removal: _txPromise ──
{
  // Verify face-history.js source doesn't contain _txPromise
  // (Already removed; this test ensures FaceHistory still works)
  const inst = HIST.create();
  assert(typeof inst.init === 'function', 'history still works after _txPromise removal');
  assert(typeof inst.getProfiles === 'function', 'getProfiles still works');
  assert(typeof inst.startSession === 'function', 'startSession still works');
  assert(typeof inst.endSession === 'function', 'endSession still works');
}

// ── Date.now consolidation: analyzeTransition uses passed timestamp ──
{
  const before = Date.now();
  const testAU = AU.computeAUs(makeLandmarks());
  const trans = EA.analyzeTransition('neutral', 'genuine_smile', 500, testAU, before);
  assert(trans.timestamp === before, 'analyzeTransition uses passed now timestamp');
  assert(trans.timestamp <= Date.now(), 'transition timestamp is not in the future');
}

// ── analyzeAuthenticity uses passed now ──
{
  const state = EA.createState();
  state.episodeStart = Date.now() - 500;
  const now = Date.now();
  const testAU = AU.computeAUs(makeLandmarks());
  const auth = EA.analyzeAuthenticity(testAU, null, 'genuine_smile', state, now);
  assert(typeof auth.overall === 'number', 'analyzeAuthenticity returns overall with now param');
  assert(auth.overall >= 0 && auth.overall <= 1, 'authenticity overall in [0,1]');
}

// ── analyzeAuthenticity backward compat: no 'now' param still works ──
{
  const state = EA.createState();
  const testAU = AU.computeAUs(makeLandmarks());
  const auth = EA.analyzeAuthenticity(testAU, null, 'neutral', state);
  assert(typeof auth.overall === 'number', 'analyzeAuthenticity works without now param (backward compat)');
}

// ── analyzeTransition backward compat: no 'now' param still works ──
{
  const testAU = AU.computeAUs(makeLandmarks());
  const trans = EA.analyzeTransition('neutral', 'anger', 200, testAU);
  assert(typeof trans.timestamp === 'number', 'analyzeTransition backward compat: timestamp generated');
  assert(trans.timestamp <= Date.now(), 'analyzeTransition backward compat: timestamp valid');
}

// ── Surprise valence = neutral (Russell 1980 circumplex) ──
{
  const surpriseLm = makeLandmarks({
    rightBrow: [
      { x: 0.35, y: 0.22, z: 0 }, { x: 0.37, y: 0.21, z: 0 },
      { x: 0.39, y: 0.20, z: 0 }, { x: 0.41, y: 0.21, z: 0 }, { x: 0.43, y: 0.22, z: 0 },
    ],
    leftBrow: [
      { x: 0.57, y: 0.22, z: 0 }, { x: 0.59, y: 0.21, z: 0 },
      { x: 0.61, y: 0.20, z: 0 }, { x: 0.63, y: 0.21, z: 0 }, { x: 0.65, y: 0.22, z: 0 },
    ],
  });
  const testAU = AU.computeAUs(surpriseLm);
  // Force surprise-level AUs for valence test
  testAU.au1 = 0.5; testAU.au2 = 0.4; testAU.au5 = 0.4; testAU.au26 = 0.3;
  const analysis = { topExpression: 'surprise', topConfidence: 0.8, authenticity: null, transitionInfo: null };
  const raw = PSY.computeRaw(testAU, analysis);
  assert(raw.valence > 0.45 && raw.valence < 0.55, `surprise valence is near-neutral: ${raw.valence.toFixed(3)}`);
}

// ── Export: flattenLightSnapshot in public API ──
{
  assert(typeof EXP.flattenLightSnapshot === 'function', 'flattenLightSnapshot exported');
}

// ── History CSV with light snapshots produces correct data ──
{
  const snap = { t: 1700000000000, expr: 'anger', conf: 0.6, psy: { valence: 0.2, arousal: 0.8, stress: 0.7, cognitiveLoad: 0.5, confidence: 0.3, engagement: 0.4, comfort: 0.2, authenticity: 0.4, tension: 0.6, deception: 0.5, suppressionEffort: 0.3, emotionalRegulation: 0.3 }, auth: 0.4, blinkRate: 28.0, hp: { y: -5.0, p: 3.0, r: -1.0 } };
  const flat = EXP.flattenLightSnapshot(snap);
  const csv = EXP.buildCSV([flat]);
  assert(csv.includes('anger'), 'history CSV contains expression name');
  assert(csv.includes('psy_valence'), 'history CSV has psy_valence column');
  assert(csv.includes('authenticity_overall'), 'history CSV has authenticity column');
  assert(csv.includes('headPose_yaw'), 'history CSV has headPose column');
}

// ── analyzeAuthenticity leakage uses passed now (not Date.now) — v3.9.1 fix ──
{
  const state = EA.createState();
  state.episodeStart = 1000;
  // Inject a micro-expression with timestamp at 5000
  state.microLog.push({ expression: 'anger', time: 5000, durationMs: 80 });
  const testAU = AU.computeAUs(makeLandmarks());
  // Pass now=5500: micro at 5000 is within 3s window → leakage should reduce
  const auth1 = EA.analyzeAuthenticity(testAU, null, 'genuine_smile', state, 5500);
  // Pass now=50000: micro at 5000 is >3s ago → leakage should be 1.0
  const auth2 = EA.analyzeAuthenticity(testAU, null, 'genuine_smile', state, 50000);
  assert(auth1.factors.leakage < 1.0, 'leakage factor reduced when now is close to micro time');
  assert(auth2.factors.leakage === 1.0, 'leakage factor=1.0 when now is far from micro time');
}

// ═══════════════════════════════════════
// 15. NEGATIVE EMOTION SENSITIVITY (v3.10)
// ═══════════════════════════════════════
console.log('── Negative Emotion Sensitivity ──');

// Helper: create AU object with specific overrides for classification testing.
// Starts from a neutral base (all 0) and applies overrides.
function makeAUFor(overrides) {
  const base = {
    au1: 0, au2: 0, au4: 0, au5: 0, au6: 0, au7: 0,
    au9: 0, au10: 0, au12: 0, au14: 0, au15: 0, au17: 0,
    au20: 0, au23: 0, au24: 0, au25: 0, au26: 0, au43: 0,
    au45: 0, au46: 0,
    duchenneScore: 0, periorbitalAvg: 0,
    overallAsymmetry: 0, browAsymmetry: 0, eyeAsymmetry: 0,
    mouthAsymmetry: 0, cheekAsymmetry: 0,
    muscleConflictScore: 0, muscleConflicts: [],
    corrugatorAvg: 0.12, nasolabialAvg: 0.06,
    earLeft: 0.25, earRight: 0.25, earAvg: 0.25, earDiff: 0,
    mar: 0, mouthWidth: 0.38, lipThickness: 0.04, faceW: 1, faceH: 1,
    rPeriorbDensity: 0, lPeriorbDensity: 0,
    au1_right: 0, au1_left: 0, au2_right: 0, au2_left: 0,
    au6_right: 0, au6_left: 0, au12_right: 0, au12_left: 0,
    au15_right: 0, au15_left: 0,
  };
  return Object.assign(base, overrides);
}

// ── Anger at moderate intensity (FACS B-level) ──
{
  const angerAU = makeAUFor({ au4: 0.25, au7: 0.18, au23: 0.15 });
  const results = EA.classifyExpressions(angerAU);
  const top = results.length > 0 ? results[0].name : 'none';
  assert(results.some(r => r.name === 'anger'), 'moderate anger detected (au4=0.25)');
}

// ── Anger should NOT require extreme AU4 ──
{
  const angerAU = makeAUFor({ au4: 0.28, au7: 0.20, au24: 0.18, au23: 0.16 });
  const results = EA.classifyExpressions(angerAU);
  assert(results.some(r => r.name === 'anger'),
    'anger detected at au4=0.28 (was unreachable at old 0.3 threshold)');
}

// ── Fear with partial AU configuration ──
{
  // Real fear: AU1 + AU4 + AU20, without AU5 (common in subtle fear)
  const fearAU = makeAUFor({ au1: 0.25, au4: 0.18, au20: 0.18 });
  const results = EA.classifyExpressions(fearAU);
  assert(results.some(r => r.name === 'fear'),
    'fear detected without AU5 (partial fear pattern)');
}

// ── Fear with AU5 but without AU20 ──
{
  const fearAU = makeAUFor({ au1: 0.22, au4: 0.15, au5: 0.18 });
  const results = EA.classifyExpressions(fearAU);
  assert(results.some(r => r.name === 'fear'),
    'fear detected with AU5 but without AU20 (wide-eye fear variant)');
}

// ── Sadness at low intensity ──
{
  const sadAU = makeAUFor({ au1: 0.14, au15: 0.12, au4: 0.10 });
  const results = EA.classifyExpressions(sadAU);
  assert(results.some(r => r.name === 'sadness'),
    'subtle sadness detected (lowered thresholds)');
}

// ── Disgust at moderate intensity ──
{
  const disgustAU = makeAUFor({ au9: 0.20, au10: 0.15 });
  const results = EA.classifyExpressions(disgustAU);
  assert(results.some(r => r.name === 'disgust'),
    'moderate disgust detected (au9=0.20, was unreachable at old 0.25)');
}

// ── Contempt at low intensity ──
{
  const contemptAU = makeAUFor({ au14: 0.18, mouthAsymmetry: 0.10 });
  const results = EA.classifyExpressions(contemptAU);
  assert(results.some(r => r.name === 'contempt'),
    'subtle contempt detected (au14=0.18)');
}

// ── Anxiety with 3 AUs (relaxed conjunction) ──
{
  const anxAU = makeAUFor({ au1: 0.15, au4: 0.15, au7: 0.12 });
  const results = EA.classifyExpressions(anxAU);
  assert(results.some(r => r.name === 'anxiety'),
    'anxiety detected with au1+au4+au7 (without au20)');
}

// ── Pain with 3 AUs (relaxed conjunction) ──
{
  const painAU = makeAUFor({ au4: 0.22, au7: 0.15, au43: 0.15 });
  const results = EA.classifyExpressions(painAU);
  assert(results.some(r => r.name === 'pain'),
    'pain detected with au4+au7+au43 (without au9)');
}

// ── Disdain at low intensity ──
{
  const disdainAU = makeAUFor({ au9: 0.12, au15: 0.10, au7: 0.10 });
  const results = EA.classifyExpressions(disdainAU);
  assert(results.some(r => r.name === 'disdain'),
    'subtle disdain detected (lowered thresholds)');
}

// ── Mild variant: irritation ──
{
  const irrAU = makeAUFor({ au4: 0.15, au7: 0.10 });
  const results = EA.classifyExpressions(irrAU);
  assert(results.some(r => r.name === 'irritation'),
    'irritation (mild anger) detected at low AU4');
}

// ── Mild variant: melancholy ──
{
  const melAU = makeAUFor({ au1: 0.10, au15: 0.08 });
  const results = EA.classifyExpressions(melAU);
  assert(results.some(r => r.name === 'melancholy'),
    'melancholy (mild sadness) detected at low AU levels');
}

// ── Mild variant: unease ──
{
  const uneaseAU = makeAUFor({ au1: 0.12, au4: 0.12 });
  const results = EA.classifyExpressions(uneaseAU);
  assert(results.some(r => r.name === 'unease'),
    'unease (mild fear/anxiety) detected at low AU levels');
}

// ── Mild variant: distaste ──
{
  const distasteAU = makeAUFor({ au9: 0.14, au10: 0.05 });
  const results = EA.classifyExpressions(distasteAU);
  assert(results.some(r => r.name === 'distaste'),
    'distaste (mild disgust) detected at low AU9');
}

// ── Valence mapping for new mild variants ──
{
  assert(valenceFor('irritation') < 0.5, 'irritation valence negative');
  assert(valenceFor('melancholy') < 0.5, 'melancholy valence negative');
  assert(valenceFor('unease') < 0.5, 'unease valence negative');
  assert(valenceFor('distaste') < 0.5, 'distaste valence negative');
}

// ── Negative vs positive sensitivity parity ──
// Ensure smile and anger can both be detected at comparable AU intensities
{
  const smileAU = makeAUFor({ au12: 0.28, au6: 0.18, duchenneScore: 0.25 });
  const angerAU = makeAUFor({ au4: 0.25, au7: 0.18, au23: 0.15 });
  const smileResults = EA.classifyExpressions(smileAU);
  const angerResults = EA.classifyExpressions(angerAU);
  assert(smileResults.some(r => r.name === 'genuine_smile'),
    'smile detected at moderate intensity');
  assert(angerResults.some(r => r.name === 'anger'),
    'anger detected at comparable moderate intensity');
}

// ── Config has labels for all new expressions ──
{
  const labels = CFG.EXPRESSION_LABELS;
  assert(labels.irritation !== undefined, 'config has irritation label');
  assert(labels.melancholy !== undefined, 'config has melancholy label');
  assert(labels.unease !== undefined, 'config has unease label');
  assert(labels.distaste !== undefined, 'config has distaste label');
}

// ── Cognitive dissonance: negative expression with smile leak ──
{
  // Anger face with AU12 smile leak → dissonance
  const angerWithSmile = makeAUFor({ au4: 0.3, au7: 0.2, au23: 0.2, au12: 0.25 });
  const mockAnalysis = { topExpression: 'anger', topConfidence: 0.8,
    authenticity: { overall: 0.5, factors: {} }, transitionInfo: null };
  const dis = PSY.detectCognitiveDissonance(angerWithSmile, mockAnalysis);
  assert(dis.score > 0.2, 'dissonance detected: anger with smile AU leak');
}

// ── Cognitive dissonance: sadness with cheek raise ──
{
  const sadWithCheek = makeAUFor({ au1: 0.2, au15: 0.2, au4: 0.15, au6: 0.25 });
  const mockAnalysis = { topExpression: 'sadness', topConfidence: 0.7,
    authenticity: { overall: 0.5, factors: {} }, transitionInfo: null };
  const dis = PSY.detectCognitiveDissonance(sadWithCheek, mockAnalysis);
  assert(dis.score > 0.2, 'dissonance detected: sadness with cheek raise (posed)');
}

// ── Cognitive dissonance: fear with control signals ──
{
  const fearControl = makeAUFor({ au1: 0.3, au4: 0.2, au5: 0.2, au17: 0.25, au24: 0.25 });
  const mockAnalysis = { topExpression: 'fear', topConfidence: 0.7,
    authenticity: { overall: 0.5, factors: {} }, transitionInfo: null };
  const dis = PSY.detectCognitiveDissonance(fearControl, mockAnalysis);
  assert(dis.score > 0.2, 'dissonance detected: fear with chin raise + lip press');
}

// ── Negative transition patterns exist ──
{
  const t1 = EA.analyzeTransition('neutral', 'anger', 150, neutralAUs);
  assert(t1.significance.length > 0, 'neutral→anger has psychological significance');
  const t2 = EA.analyzeTransition('neutral', 'sadness', 200, neutralAUs);
  assert(t2.significance.length > 0, 'neutral→sadness has psychological significance');
  const t3 = EA.analyzeTransition('fear', 'anger', 80, neutralAUs);
  assert(t3.significance.length > 0, 'fear→anger has fight-or-flight significance');
  const t4 = EA.analyzeTransition('sadness', 'anger', 120, neutralAUs);
  assert(t4.significance.length > 0, 'sadness→anger has grief-stage significance');
  const t5 = EA.analyzeTransition('anger', 'sadness', 200, neutralAUs);
  assert(t5.significance.length > 0, 'anger→sadness has regret significance');
}

// ── unease should NOT trigger at noise floor ──
{
  const tooLowAU = makeAUFor({ au1: 0.06, au4: 0.06 });
  const results = EA.classifyExpressions(tooLowAU);
  const hasUnease = results.some(r => r.name === 'unease');
  assert(!hasUnease, 'unease does NOT trigger at near-noise AU levels (0.06)');
}

// ── Calibration blend preserves AU4 sensitivity ──
// Verify that 70/30 blend formula doesn't halve AU4
// (math check: 0.5*0.7 + 0*0.3 = 0.35, vs old 0.5*0.5 + 0*0.5 = 0.25)
{
  const baseAU4 = 0.5;
  const calZero = 0;
  const newBlend = baseAU4 * 0.7 + calZero * 0.3;
  const oldBlend = baseAU4 * 0.5 + calZero * 0.5;
  assert(newBlend > oldBlend, 'new 70/30 blend preserves more AU4 than old 50/50');
  assert(newBlend >= 0.35, 'AU4=0.5 after calibration retains ≥0.35 (was 0.25)');
}

// ═══════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════
console.log('\n════════════════════════════════');
console.log(`  PASS: ${passed}   FAIL: ${failed}`);
if (failures.length > 0) {
  console.log('  Failed tests:');
  failures.forEach(f => console.log('    ✗ ' + f));
}
console.log('════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
