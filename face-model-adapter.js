/* ═══════════════════════════════════════════════════════════════
 *  face-model-adapter.js – Optional learned AU provider contract
 *
 *  No model is bundled. A provider may only be enabled after its
 *  provenance, license, label mapping, and evaluation metadata have
 *  been supplied. Rule estimates remain the deterministic fallback.
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function validateMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') return false;
    return Boolean(
      metadata.name && metadata.version && metadata.license &&
      metadata.trainingData && metadata.labelMap && metadata.metrics
    );
  }

  function create(provider, options) {
    options = options || {};
    var enabled = Boolean(provider && typeof provider.predict === 'function' && validateMetadata(provider.metadata));
    var maxModelWeight = clamp(options.maxModelWeight == null ? 0.65 : options.maxModelWeight, 0, 0.8);

    return {
      isEnabled: function () { return enabled; },
      metadata: function () { return enabled ? provider.metadata : null; },
      predict: function (features) {
        if (!enabled) return null;
        try {
          var prediction = provider.predict(features);
          if (!prediction || typeof prediction !== 'object') return null;
          return prediction;
        } catch {
          return null;
        }
      },
      fuse: function (ruleAUs, learnedAUs, quality) {
        if (!enabled || !learnedAUs) return { aus: ruleAUs, source: 'rules', modelWeight: 0 };
        var qualityScore = quality ? quality.score : 0.5;
        var modelConfidence = clamp(learnedAUs.confidence == null ? 0 : learnedAUs.confidence, 0, 1);
        var weight = Math.min(maxModelWeight, modelConfidence * qualityScore * maxModelWeight);
        if (weight < 0.10) return { aus: ruleAUs, source: 'rules', modelWeight: 0 };
        var fused = {};
        var keys = Object.keys(ruleAUs);
        for (var i = 0; i < keys.length; i++) fused[keys[i]] = ruleAUs[keys[i]];
        var values = learnedAUs.values || {};
        var learnedKeys = Object.keys(values);
        for (var j = 0; j < learnedKeys.length; j++) {
          var key = learnedKeys[j];
          if (!/^au\d+$/.test(key) || typeof ruleAUs[key] !== 'number') continue;
          fused[key] = clamp(ruleAUs[key] * (1 - weight) + clamp(values[key], 0, 1) * weight, 0, 1);
        }
        return { aus: fused, source: 'hybrid', modelWeight: weight };
      },
    };
  }

  global.FaceModelAdapter = Object.freeze({
    validateMetadata: validateMetadata,
    create: create,
  });
})(typeof window !== 'undefined' ? window : globalThis);
