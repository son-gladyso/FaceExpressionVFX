/* ═══════════════════════════════════════════════════════════════
 *  face-temporal.js – Explicit-duration Bayesian expression filter
 *
 *  This is a lightweight semi-Markov approximation: state persistence
 *  depends on elapsed episode duration, while observations are fused as
 *  a normalized posterior. It replaces frame-count hysteresis.
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createState(options) {
    options = options || {};
    return {
      current: 'neutral',
      posterior: { neutral: 1 },
      enteredAt: 0,
      lastTimestamp: 0,
      candidate: null,
      candidateSince: 0,
      minHoldNeutralMs: options.minHoldNeutralMs || 120,
      minHoldActiveMs: options.minHoldActiveMs || 90,
      candidateHoldMs: options.candidateHoldMs || 75,
      maxHoldMs: options.maxHoldMs || 4500,
    };
  }

  function observationDistribution(classifications, qualityScale) {
    var obs = {};
    var sum = 0;
    qualityScale = clamp(typeof qualityScale === 'number' ? qualityScale : 1, 0, 1);
    for (var i = 0; i < classifications.length; i++) {
      var item = classifications[i];
      var value = clamp(item.confidence || 0, 0, 1) * qualityScale;
      if (value <= 0) continue;
      obs[item.name] = Math.max(obs[item.name] || 0, value);
      sum += value;
    }
    var neutral = clamp(1 - Math.min(0.90, sum), 0.08, 1);
    if (qualityScale < 0.55) neutral = Math.max(neutral, 1 - qualityScale);
    obs.neutral = Math.max(obs.neutral || 0, neutral);

    var keys = Object.keys(obs);
    var total = 0;
    for (var k = 0; k < keys.length; k++) total += obs[keys[k]];
    for (var n = 0; n < keys.length; n++) obs[keys[n]] /= total || 1;
    return obs;
  }

  function durationStayProbability(state, now) {
    var elapsed = state.enteredAt ? now - state.enteredAt : 0;
    var minHold = state.current === 'neutral' ? state.minHoldNeutralMs : state.minHoldActiveMs;
    if (elapsed < minHold) return 0.992;
    if (elapsed <= state.maxHoldMs) return 0.94;
    return 0.82;
  }

  function normalizedEntropy(distribution) {
    var keys = Object.keys(distribution);
    if (keys.length <= 1) return 0;
    var entropy = 0;
    for (var i = 0; i < keys.length; i++) {
      var p = distribution[keys[i]];
      if (p > 0) entropy -= p * Math.log(p);
    }
    return clamp(entropy / Math.log(keys.length), 0, 1);
  }

  function update(state, classifications, now, quality) {
    now = typeof now === 'number' ? now : Date.now();
    if (!state.enteredAt) state.enteredAt = now;
    var qualityScale = quality && typeof quality.confidenceScale === 'number'
      ? quality.confidenceScale : 1;
    if (quality && quality.action === 'pause') {
      state.lastTimestamp = now;
      return {
        label: state.current,
        confidence: 0,
        posterior: state.posterior,
        entropy: 1,
        changed: false,
        durationMs: now - state.enteredAt,
        paused: true,
      };
    }

    var observation = observationDistribution(classifications || [], qualityScale);
    var labelSet = {};
    var oldKeys = Object.keys(state.posterior);
    var obsKeys = Object.keys(observation);
    for (var i = 0; i < oldKeys.length; i++) labelSet[oldKeys[i]] = true;
    for (var j = 0; j < obsKeys.length; j++) labelSet[obsKeys[j]] = true;
    labelSet[state.current] = true;
    var labels = Object.keys(labelSet);

    var stay = durationStayProbability(state, now);
    var transitionMass = 1 - stay;
    var predicted = {};
    var alternativeCount = Math.max(1, labels.length - 1);
    for (var p = 0; p < labels.length; p++) {
      var label = labels[p];
      var previous = state.posterior[label] || 0;
      predicted[label] = previous * (label === state.current ? stay : 0.88);
      if (label !== state.current) predicted[label] += (state.posterior[state.current] || 0) * transitionMass / alternativeCount;
      predicted[label] += 0.002;
    }

    var posterior = {};
    var total = 0;
    var observationPower = 0.55 + qualityScale * 1.15;
    for (var q = 0; q < labels.length; q++) {
      var name = labels[q];
      var likelihood = Math.pow(Math.max(observation[name] || 0.01, 0.01), observationPower);
      posterior[name] = predicted[name] * likelihood;
      total += posterior[name];
    }
    for (var r = 0; r < labels.length; r++) posterior[labels[r]] /= total || 1;

    var bestLabel = state.current;
    var bestProb = posterior[bestLabel] || 0;
    for (var b = 0; b < labels.length; b++) {
      if (posterior[labels[b]] > bestProb) {
        bestLabel = labels[b]; bestProb = posterior[labels[b]];
      }
    }

    var changed = false;
    if (bestLabel !== state.current) {
      if (state.candidate !== bestLabel) {
        state.candidate = bestLabel;
        state.candidateSince = now;
      }
      var currentProb = posterior[state.current] || 0;
      var currentDuration = now - state.enteredAt;
      var minCurrent = state.current === 'neutral' ? state.minHoldNeutralMs : state.minHoldActiveMs;
      var candidateDuration = now - state.candidateSince;
      var strongEnough = bestProb >= Math.max(0.38, currentProb * 1.12);
      if (currentDuration >= minCurrent && candidateDuration >= state.candidateHoldMs && strongEnough) {
        state.current = bestLabel;
        state.enteredAt = now;
        state.candidate = null;
        state.candidateSince = 0;
        changed = true;
      }
    } else {
      state.candidate = null;
      state.candidateSince = 0;
    }

    state.posterior = posterior;
    state.lastTimestamp = now;
    return {
      label: state.current,
      confidence: clamp(posterior[state.current] || 0, 0, 1),
      posterior: posterior,
      entropy: normalizedEntropy(posterior),
      changed: changed,
      durationMs: now - state.enteredAt,
      paused: false,
    };
  }

  global.FaceTemporal = Object.freeze({
    createState: createState,
    observationDistribution: observationDistribution,
    update: update,
  });
})(typeof window !== 'undefined' ? window : globalThis);
