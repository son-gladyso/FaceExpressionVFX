/* ═══════════════════════════════════════════════════════════════
 *  face-observables.js – Observable facial movement summaries
 *
 *  Values are descriptive geometry/motion proxies. They are not
 *  estimates of intent, truthfulness, diagnosis, or mental state.
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var DEFINITIONS = Object.freeze({
    browRaise: ['au1', 'au2'],
    browLower: ['au4'],
    eyeOpening: ['au5'],
    eyeClosure: ['au43', 'au45'],
    cheekRaise: ['au6'],
    noseWrinkle: ['au9'],
    lipCornerPull: ['au12'],
    lipCornerDepress: ['au15'],
    mouthOpening: ['au25', 'au26'],
    lipCompression: ['au23', 'au24'],
    bilateralAsymmetry: [],
    motionEnergy: [],
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function maxAU(aus, keys) {
    var value = 0;
    for (var i = 0; i < keys.length; i++) value = Math.max(value, Number(aus[keys[i]]) || 0);
    return clamp(value, 0, 1);
  }

  function estimateFor(keys, estimates, fallbackValue, qualityScore) {
    if (!keys.length || !estimates) {
      var fallbackConfidence = clamp(typeof qualityScore === 'number' ? qualityScore : 0.65, 0, 1);
      var width = 0.05 + (1 - fallbackConfidence) * 0.30;
      return {
        value: fallbackValue,
        lower: clamp(fallbackValue - width, 0, 1),
        upper: clamp(fallbackValue + width, 0, 1),
        confidence: fallbackConfidence,
      };
    }
    var chosen = null;
    for (var i = 0; i < keys.length; i++) {
      var candidate = estimates[keys[i]];
      if (!candidate) continue;
      if (!chosen || candidate.value > chosen.value) chosen = candidate;
    }
    return chosen ? {
      value: fallbackValue,
      lower: chosen.lower,
      upper: chosen.upper,
      confidence: chosen.confidence,
    } : estimateFor([], null, fallbackValue, qualityScore);
  }

  function motionEnergy(dynamics) {
    if (!dynamics || !dynamics.velocity) return 0;
    var keys = Object.keys(dynamics.velocity);
    if (!keys.length) return 0;
    var total = 0;
    for (var i = 0; i < keys.length; i++) total += Math.abs(dynamics.velocity[keys[i]] || 0);
    return clamp(total / keys.length * 6, 0, 1);
  }

  function compute(aus, dynamics, quality, auEstimates, temporal) {
    var qualityScore = quality ? quality.score : 0.65;
    var values = {
      browRaise: maxAU(aus, DEFINITIONS.browRaise),
      browLower: maxAU(aus, DEFINITIONS.browLower),
      eyeOpening: maxAU(aus, DEFINITIONS.eyeOpening),
      eyeClosure: maxAU(aus, DEFINITIONS.eyeClosure),
      cheekRaise: maxAU(aus, DEFINITIONS.cheekRaise),
      noseWrinkle: maxAU(aus, DEFINITIONS.noseWrinkle),
      lipCornerPull: maxAU(aus, DEFINITIONS.lipCornerPull),
      lipCornerDepress: maxAU(aus, DEFINITIONS.lipCornerDepress),
      mouthOpening: maxAU(aus, DEFINITIONS.mouthOpening),
      lipCompression: maxAU(aus, DEFINITIONS.lipCompression),
      bilateralAsymmetry: clamp(aus.overallAsymmetry || 0, 0, 1),
      motionEnergy: motionEnergy(dynamics),
    };
    var intervals = {};
    var keys = Object.keys(DEFINITIONS);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      intervals[key] = estimateFor(DEFINITIONS[key], auEstimates, values[key], qualityScore);
    }
    if (temporal && typeof temporal.entropy === 'number') {
      intervals.motionEnergy.confidence *= (1 - temporal.entropy * 0.35);
    }
    return {
      values: values,
      intervals: intervals,
      quality: qualityScore,
      temporalUncertainty: temporal ? temporal.entropy : 1,
    };
  }

  global.FaceObservables = Object.freeze({
    DEFINITIONS: DEFINITIONS,
    compute: compute,
  });
})(typeof window !== 'undefined' ? window : globalThis);
