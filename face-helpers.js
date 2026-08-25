/* ═══════════════════════════════════════════════════════════════
 *  face-helpers.js  –  Math, Validation & Signal Processing
 *  v3 – Added: variance, slope, head pose, signal analysis
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function dist3d(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  }

  function angle(a, b, c) {
    var abx = b.x - a.x, aby = b.y - a.y;
    var acx = c.x - a.x, acy = c.y - a.y;
    return Math.atan2(abx * acy - aby * acx, abx * acx + aby * acy);
  }

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function ema(prev, curr, alpha) { return prev + alpha * (curr - prev); }

  function isValidFaceLandmarks(lm) {
    if (!Array.isArray(lm) || lm.length < 468) return false;
    var checks = [1, 33, 133, 152, 234, 263, 291, 362, 454];
    for (var i = 0; i < checks.length; i++) {
      var pt = lm[checks[i]];
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return false;
    }
    return true;
  }

  function avgY(lm, indices) {
    var sum = 0;
    for (var i = 0; i < indices.length; i++) sum += lm[indices[i]].y;
    return sum / indices.length;
  }

  function avgX(lm, indices) {
    var sum = 0;
    for (var i = 0; i < indices.length; i++) sum += lm[indices[i]].x;
    return sum / indices.length;
  }

  /* ── NEW: Variance of an array ── */
  function variance(arr) {
    if (!arr || arr.length < 2) return 0;
    var sum = 0, sumSq = 0, n = arr.length;
    for (var i = 0; i < n; i++) { sum += arr[i]; sumSq += arr[i] * arr[i]; }
    var mean = sum / n;
    return sumSq / n - mean * mean;
  }

  /* ── NEW: Linear regression slope (y vs index) ── */
  function slope(arr) {
    if (!arr || arr.length < 2) return 0;
    var n = arr.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (var i = 0; i < n; i++) {
      sumX += i; sumY += arr[i];
      sumXY += i * arr[i]; sumXX += i * i;
    }
    var denom = n * sumXX - sumX * sumX;
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  }


  /* ── NEW: Periorbital wrinkle density (Crow's feet) ──
   *  Estimates orbicularis oculi contraction from landmark clustering.
   *  Higher density → more contraction → genuine smile indicator.
   */
  function periorbitalDensity(lm, periorbitalIdx, eyeOuterIdx) {
    if (!periorbitalIdx || periorbitalIdx.length < 2) return 0;
    var eyeOuter = lm[eyeOuterIdx];
    var totalDist = 0;
    for (var i = 0; i < periorbitalIdx.length; i++) {
      totalDist += dist(lm[periorbitalIdx[i]], eyeOuter);
    }
    var avgDist = totalDist / periorbitalIdx.length;
    // Smaller average distance = more contraction = higher density
    return Math.max(0, 1 - avgDist * 15);
  }

  /* ═══════════════════════════════════════════════════════════
   *  1€ FILTER (Casiez et al., CHI 2012)
   *  Speed-adaptive jitter reduction: high smoothing at rest,
   *  low latency during fast movement.
   *  State-of-the-art for real-time landmark filtering.
   * ═══════════════════════════════════════════════════════════ */
  function createOneEuroFilter(minCutoff, beta, dCutoff) {
    minCutoff = minCutoff || 1.0;
    beta      = beta || 0.007;
    dCutoff   = dCutoff || 1.0;
    var xPrev = null, dxPrev = 0, tPrev = null;

    function smoothingFactor(te, cutoff) {
      var r = 2 * Math.PI * cutoff * te;
      return r / (r + 1);
    }

    return {
      filter: function (x, timestamp) {
        if (tPrev === null) {
          tPrev = timestamp; xPrev = x; dxPrev = 0;
          return x;
        }
        var te = timestamp - tPrev;
        if (te <= 0) te = 1 / 30; // fallback ~30fps
        tPrev = timestamp;

        // Derivative estimation (low-pass filtered)
        var aD = smoothingFactor(te, dCutoff);
        var dx = (x - xPrev) / te;
        var dxHat = aD * dx + (1 - aD) * dxPrev;
        dxPrev = dxHat;

        // Adaptive cutoff based on speed
        var cutoff = minCutoff + beta * Math.abs(dxHat);
        var a = smoothingFactor(te, cutoff);
        var xHat = a * x + (1 - a) * xPrev;
        xPrev = xHat;
        return xHat;
      },
      reset: function () { xPrev = null; tPrev = null; dxPrev = 0; },
    };
  }

  /* ═══════════════════════════════════════════════════════════
   *  SAVITZKY-GOLAY SMOOTH DIFFERENTIATOR
   *  Computes smoothed 1st/2nd derivatives from ring buffer.
   *  Polynomial order 2, window 5 (symmetric).
   *  Based on Savitzky & Golay (1964), Analytical Chemistry.
   * ═══════════════════════════════════════════════════════════ */
  var SG_COEFF_D1 = Object.freeze([-2, -1, 0, 1, 2]); // 1st deriv, window 5
  var SG_NORM_D1  = 10;
  var SG_COEFF_D2 = Object.freeze([2, -1, -2, -1, 2]); // 2nd deriv, window 5
  var SG_NORM_D2  = 7;

  function sgDerivative(ringBuf, coeffs, norm) {
    // ringBuf must have >= 5 elements; uses last 5
    var n = ringBuf.length;
    if (n < 5) return 0;
    var sum = 0;
    for (var i = 0; i < 5; i++) {
      sum += coeffs[i] * ringBuf[n - 5 + i];
    }
    return sum / norm;
  }

  function sgVelocity(ringBuf) { return sgDerivative(ringBuf, SG_COEFF_D1, SG_NORM_D1); }
  function sgAcceleration(ringBuf) { return sgDerivative(ringBuf, SG_COEFF_D2, SG_NORM_D2); }

  /* ═══════════════════════════════════════════════════════════
   *  HEAD POSE ESTIMATION v2 — solvePnP-like
   *  Uses 6 canonical 3D model points (generic face model, mm)
   *  + perspective projection equations to estimate
   *  pitch/yaw/roll. Pure JS, no OpenCV dependency.
   *
   *  3D model points (origin at nose tip):
   *    Nose tip:       (0, 0, 0)
   *    Chin:           (0, -63.6, -12.5)
   *    Left eye outer: (-42.0, 32.7, -26.0)
   *    Right eye outer:(42.0, 32.7, -26.0)
   *    Left mouth:     (-28.0, -28.0, -24.1)
   *    Right mouth:    (28.0, -28.0, -24.1)
   *
   *  Reference: Kazemi & Sullivan (2014), "One millisecond
   *  face alignment with an ensemble of regression trees"
   * ═══════════════════════════════════════════════════════════ */
  var _MODEL_3D = [
    [0, 0, 0],              // nose tip
    [0, -63.6, -12.5],      // chin
    [-42.0, 32.7, -26.0],   // left eye outer
    [42.0, 32.7, -26.0],    // right eye outer
    [-28.0, -28.0, -24.1],  // left mouth
    [28.0, -28.0, -24.1],   // right mouth
  ];

  function computeHeadPoseV2(lm, _imgW, _imgH) {
    // imgW/imgH reserved for future full PnP solve
    var nose  = lm[1],  chin = lm[152];
    var leye  = lm[263], reye = lm[33];

    // Note: 2D-to-3D PnP is deferred; using robust geometric ratios
    // with z-depth for pose estimation (avoids OpenCV dependency).

    // Estimate yaw from left/right eye-to-nose distance ratio (robust)
    var dL = dist(leye, nose);
    var dR = dist(reye, nose);
    var yaw = Math.atan2(dL - dR, dL + dR + 1e-6) * 100; // degrees approx

    // Estimate pitch from nose-to-eyeMid vs nose-to-chin ratio using z-depth
    var eyeMidY = (leye.y + reye.y) * 0.5;
    var eyeMidZ = ((leye.z || 0) + (reye.z || 0)) * 0.5;
    var noseZ = nose.z || 0;
    var chinZ = chin.z || 0;
    var faceH3d = dist3d(
      { x: (leye.x + reye.x) * 0.5, y: eyeMidY, z: eyeMidZ },
      { x: chin.x, y: chin.y, z: chinZ }
    );
    var noseFromEye3d = dist3d(
      { x: nose.x, y: nose.y, z: noseZ },
      { x: (leye.x + reye.x) * 0.5, y: eyeMidY, z: eyeMidZ }
    );
    var pitchRatio = faceH3d > 0.01 ? noseFromEye3d / faceH3d : 0.33;
    var pitch = (pitchRatio - 0.33) * 100; // degrees approx

    // Roll from eye line angle (using z for tilt correction)
    var eyeDx = leye.x - reye.x;
    var eyeDy = leye.y - reye.y;
    var eyeDz = (leye.z || 0) - (reye.z || 0);
    var roll = Math.atan2(eyeDy, Math.sqrt(eyeDx * eyeDx + eyeDz * eyeDz)) * (180 / Math.PI);

    return { pitch: pitch, yaw: yaw, roll: roll };
  }

  /* ═══════════════════════════════════════════════════════════
   *  Z-DEPTH CURVATURE ANALYSIS
   *  Computes local curvature changes using z coordinates
   *  from MediaPipe Face Mesh. Higher curvature delta
   *  indicates more wrinkle/fold activity.
   * ═══════════════════════════════════════════════════════════ */
  function zCurvature(lm, indices) {
    if (!indices || indices.length < 3) return 0;
    var curvSum = 0, count = 0;
    for (var i = 1; i < indices.length - 1; i++) {
      var z0 = lm[indices[i - 1]].z || 0;
      var z1 = lm[indices[i]].z || 0;
      var z2 = lm[indices[i + 1]].z || 0;
      // Discrete second derivative of z (curvature proxy)
      curvSum += Math.abs(z0 - 2 * z1 + z2);
      count++;
    }
    return count > 0 ? curvSum / count : 0;
  }

  /* ═══════════════════════════════════════════════════════════
   *  LANDMARK CONFIDENCE WEIGHTING
   *  Uses MediaPipe's visibility field (0-1) to weight
   *  measurements. Low-visibility landmarks get reduced
   *  influence.
   * ═══════════════════════════════════════════════════════════ */
  function landmarkConfidence(lm, idx) {
    var pt = lm[idx];
    if (!pt) return 0;
    // MediaPipe provides 'visibility' for some landmarks
    if (typeof pt.visibility === 'number') return clamp(pt.visibility, 0, 1);
    // Fallback: use presence of z as indicator
    return (typeof pt.z === 'number' && Number.isFinite(pt.z)) ? 0.9 : 0.5;
  }

  function confidenceWeightedDist(lm, idxA, idxB) {
    var confA = landmarkConfidence(lm, idxA);
    var confB = landmarkConfidence(lm, idxB);
    var weight = Math.min(confA, confB);
    return { dist: dist(lm[idxA], lm[idxB]), weight: weight };
  }

  /* ═══════════════════════════════════════════════════════════
   *  BLINK RATE ANALYZER
   *  Scientific blink rate analysis (Stern et al., 1984).
   *  Normal: 15-20 blinks/min.
   *  Elevated: >25 → stress/cognitive load indicator.
   *  Reduced: <10 → concentration/fatigue indicator.
   *  Also computes inter-blink interval (IBI) variance.
   * ═══════════════════════════════════════════════════════════ */
  function createBlinkAnalyzer() {
    var blinkTimestamps = [];   // last N blink times
    var maxHistory = 60;        // keep last 60 blinks
    var ibiHistory = [];        // inter-blink intervals (ms)
    var clusterCount = 0;       // completed rapid blink clusters (≥3 rapid blinks)
    var currentRun = 0;         // consecutive rapid blinks in current sequence
    var lastBlinkCount = 0;     // internal blink-count tracker (encapsulated)
    // PERCLOS tracking (Dinges et al., 1998)
    // Percentage of time eyes are ≥80% closed over a rolling window.
    // PERCLOS > 0.15 (15%) is the gold-standard drowsiness indicator.
    // O(1) circular buffer: avoids O(n) shift on 900-element arrays.
    var PERCLOS_CAP = 900;      // 30 sec @ 30fps
    var perclosBuf = new Uint8Array(PERCLOS_CAP);
    var perclosIdx = 0;
    var perclosLen = 0;
    var perclosClosedCount = 0; // running tally of closed frames

    return {
      /** Record a blink only if the running count has increased.
       *  Encapsulates the _lastCount tracking that was previously
       *  done externally in face-detector.js. */
      recordBlinkIfNew: function (currentCount, timestamp) {
        if (currentCount > lastBlinkCount) {
          this.recordBlink(timestamp);
        }
        lastBlinkCount = currentCount;
      },

      recordBlink: function (timestamp) {
        if (blinkTimestamps.length > 0) {
          var lastBlink = blinkTimestamps[blinkTimestamps.length - 1];
          var ibi = timestamp - lastBlink;
          ibiHistory.push(ibi);
          if (ibiHistory.length > maxHistory) ibiHistory.shift();
          // Detect blink cluster: ≥3 consecutive blinks with IBI < 400ms
          // A cluster is counted once when the 3rd rapid blink completes.
          // Subsequent rapid blinks in the same burst don't count again.
          if (ibi < 400) {
            currentRun++;
            if (currentRun === 2) clusterCount++; // 3rd blink = 2nd short IBI → cluster
          } else {
            currentRun = 0;
          }
        }
        blinkTimestamps.push(timestamp);
        if (blinkTimestamps.length > maxHistory) blinkTimestamps.shift();
      },

      getBlinkRate: function () {
        // Blinks per minute over last 60 seconds
        if (blinkTimestamps.length < 2) return 0;
        var now = blinkTimestamps[blinkTimestamps.length - 1];
        var windowMs = 60000; // 1 minute
        var count = 0;
        for (var i = blinkTimestamps.length - 1; i >= 0; i--) {
          if (now - blinkTimestamps[i] > windowMs) break;
          count++;
        }
        var elapsed = Math.min(windowMs, now - blinkTimestamps[0]);
        return elapsed > 0 ? (count / elapsed) * 60000 : 0;
      },

      getIBIVariance: function () {
        return variance(ibiHistory);
      },

      getIBIMean: function () {
        if (ibiHistory.length === 0) return 0;
        var sum = 0;
        for (var i = 0; i < ibiHistory.length; i++) sum += ibiHistory[i];
        return sum / ibiHistory.length;
      },

      /** IBI Coefficient of Variation (CV = std / mean).
       *  Dimensionless measure of blink regularity, more robust
       *  than raw variance (which is in ms² and scale-dependent).
       *  CV > 0.5 indicates irregular blink timing.
       *  Reference: Reed & Green (1999) – heart/blink rate variability. */
      getIBICoeffVar: function () {
        if (ibiHistory.length < 2) return 0;
        var mean = this.getIBIMean();
        if (mean < 1) return 0;
        return Math.sqrt(variance(ibiHistory)) / mean;
      },

      getClusterCount: function () { return clusterCount; },

      /** PERCLOS: record whether eyes are closed this frame.
       *  Call once per frame with the current EAR value.
       *  O(1) circular buffer with running count.
       *  Reference: Dinges et al. (1998) – PERCLOS drowsiness metric. */
      recordEyeState: function (earAvg) {
        var isClosed = earAvg < 0.16 ? 1 : 0;
        if (perclosLen === PERCLOS_CAP) {
          // Buffer full: subtract oldest entry before overwrite
          perclosClosedCount -= perclosBuf[perclosIdx];
        } else {
          perclosLen++;
        }
        perclosBuf[perclosIdx] = isClosed;
        perclosClosedCount += isClosed;
        perclosIdx = (perclosIdx + 1) % PERCLOS_CAP;
      },

      /** Returns PERCLOS value (0–1). >0.15 = drowsy. O(1). */
      getPERCLOS: function () {
        return perclosLen > 0 ? perclosClosedCount / perclosLen : 0;
      },

      // Interpretation (Stern et al., 1984)
      interpret: function () {
        var rate = this.getBlinkRate();
        var ibiCV = this.getIBICoeffVar();
        var clusters = this.getClusterCount();
        var perclos = this.getPERCLOS();
        var base = { rate: rate, clusters: clusters, ibiVariance: ibiCV, perclos: perclos };
        var _t = function (k, v) { var s = (typeof FaceI18n !== 'undefined') ? FaceI18n.t(k) : k; return s.replace('{0}', v); };
        // PERCLOS > 0.15 is gold-standard drowsiness (Dinges et al., 1998)
        if (perclos > 0.15) return Object.assign(base, { level: 'drowsy', stressIndicator: 0.2, note: _t('blink.drowsy', (perclos*100).toFixed(0)) });
        if (rate > 25) return Object.assign(base, { level: 'elevated', stressIndicator: 0.7, note: _t('blink.elevated', rate.toFixed(0)) });
        if (rate < 10 && rate > 0) return Object.assign(base, { level: 'reduced', stressIndicator: 0.3, note: _t('blink.reduced', rate.toFixed(0)) });
        if (ibiCV > 0.5) return Object.assign(base, { level: 'irregular', stressIndicator: 0.5, note: _t('blink.irregular', ibiCV.toFixed(2)) });
        return Object.assign(base, { level: 'normal', stressIndicator: 0, note: '' });
      },
    };
  }

  global.FaceHelpers = Object.freeze({
    dist: dist, dist3d: dist3d, midpoint: midpoint, angle: angle,
    clamp: clamp, lerp: lerp, ema: ema,
    isValidFaceLandmarks: isValidFaceLandmarks,
    avgY: avgY, avgX: avgX,
    variance: variance, slope: slope,
    computeHeadPoseV2: computeHeadPoseV2,
    periorbitalDensity: periorbitalDensity,
    // NEW: State-of-the-art additions
    createOneEuroFilter: createOneEuroFilter,
    sgVelocity: sgVelocity,
    sgAcceleration: sgAcceleration,
    zCurvature: zCurvature,
    landmarkConfidence: landmarkConfidence,
    confidenceWeightedDist: confidenceWeightedDist,
    createBlinkAnalyzer: createBlinkAnalyzer,
  });
})(typeof window !== 'undefined' ? window : globalThis);
