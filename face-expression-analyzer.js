/* ═══════════════════════════════════════════════════════════════
 *  face-expression-analyzer.js  –  Expression Classification v3
 *  Scientific Enhancement:
 *   - 25 expressions (neutral + 24 named)
 *   - Multi-factor Authenticity Engine (6 factors)
 *   - Expression Transition Tracker & Pattern Analysis
 *   - Enhanced Micro-expression Leakage Detection
 *   - Temporal onset/offset profiling
 *
 *  References:
 *    Ekman (2003) – Duchenne markers
 *    Porter & ten Brinke (2008) – Micro-expression leakage
 *    Hess & Kleck (1990) – Temporal dynamics
 *    Ekman et al. (1981) – Facial asymmetry & deception
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var CFG = null;
  function cfg() { if (!CFG) CFG = global.FaceConfig; return CFG; }

  /* ═══════════════════════════════════════
   *  Expression Classification Rules
   *  Each rule: { test(au) → bool, conf(au) → 0-1 }
   * ═══════════════════════════════════════ */
  var RULES = {
    genuine_smile: {
      test: function (a) { return a.au12 > 0.25 && a.au6 > 0.15 && a.duchenneScore > 0.2; },
      conf: function (a) { return (a.au12 * 0.4 + a.au6 * 0.3 + a.duchenneScore * 0.3); },
    },
    social_smile: {
      test: function (a) { return a.au12 > 0.25 && a.au6 < 0.20 && a.duchenneScore < 0.2; },
      conf: function (a) { return a.au12 * 0.7 + (1 - a.au6) * 0.15 + (1 - a.duchenneScore) * 0.15; },
    },
    suppressed_smile: {
      test: function (a) { return a.au12 > 0.15 && (a.au23 > 0.2 || a.au24 > 0.2); },
      conf: function (a) { return a.au12 * 0.4 + Math.max(a.au23, a.au24) * 0.4 + a.muscleConflictScore * 0.2; },
    },
    surprise: {
      test: function (a) { return a.au1 > 0.25 && a.au2 > 0.2 && a.au5 > 0.2 && a.au26 > 0.15; },
      conf: function (a) { return (a.au1 + a.au2 + a.au5 + a.au26) * 0.25; },
    },
    fear: {
      // Relaxed from strict 4-AND to 3-core + 1-auxiliary:
      // Real fear is often partial (Ekman 2003). AU1+AU4 are
      // essential; AU5 (lid raise) OR AU20 (lip stretch) sufficient.
      test: function (a) { return a.au1 > 0.18 && a.au4 > 0.12 && (a.au5 > 0.12 || a.au20 > 0.12); },
      conf: function (a) { return (a.au1 * 0.3 + a.au4 * 0.25 + a.au5 * 0.2 + a.au20 * 0.25); },
    },
    anger: {
      // Thresholds lowered: au4 0.3→0.22, au7 0.2→0.15
      // FACS intensity B (≈ 0.2) is sufficient for anger coding
      // (Ekman & Friesen 1978). Original 0.3 required intensity C+.
      test: function (a) { return a.au4 > 0.22 && a.au7 > 0.15 && (a.au23 > 0.12 || a.au24 > 0.12); },
      conf: function (a) { return (a.au4 * 0.35 + a.au7 * 0.25 + Math.max(a.au23, a.au24) * 0.25 + a.au9 * 0.15); },
    },
    disgust: {
      // au9 threshold 0.25→0.18: subtle nose wrinkling is common
      // in natural disgust (Rozin et al. 1994). FACS intensity A-B.
      test: function (a) { return a.au9 > 0.18 && a.au10 > 0.12; },
      conf: function (a) { return (a.au9 * 0.4 + a.au10 * 0.3 + a.au17 * 0.15 + a.au25 * 0.15); },
    },
    contempt: {
      // au14 threshold 0.2→0.15: contempt is a unilateral expression;
      // even slight dimpling should be detectable (Ekman & Heider 1988).
      test: function (a) { return a.au14 > 0.15 && a.mouthAsymmetry > 0.08; },
      conf: function (a) { return (a.au14 * 0.5 + a.mouthAsymmetry * 0.3 + a.au12 * 0.2); },
    },
    sadness: {
      // Thresholds lowered: au1 0.15→0.12, au15 0.15→0.10
      // Sadness is one of the most commonly suppressed emotions;
      // subtle AU15 activation should be detectable.
      test: function (a) { return a.au1 > 0.12 && a.au15 > 0.10 && a.au4 > 0.08; },
      conf: function (a) { return (a.au1 * 0.3 + a.au15 * 0.3 + a.au4 * 0.2 + a.au17 * 0.2); },
    },
    anxiety: {
      // Relaxed from strict 4-AND: au1+au4 core, au20 OR au7 auxiliary.
      // Anxiety is pervasive but subtle; original 4-AU conjunction
      // was too restrictive for natural presentations.
      test: function (a) { return a.au1 > 0.12 && a.au4 > 0.12 && (a.au20 > 0.08 || a.au7 > 0.1); },
      conf: function (a) { return (a.au1 * 0.25 + a.au4 * 0.25 + a.au20 * 0.25 + a.au7 * 0.25); },
    },
    tension: {
      test: function (a) { return a.au4 > 0.15 && a.au7 > 0.15 && (a.au23 > 0.15 || a.au24 > 0.15); },
      conf: function (a) { return (a.au4 * 0.3 + a.au7 * 0.25 + Math.max(a.au23, a.au24) * 0.25 + a.au14 * 0.2); },
    },
    concentration: {
      test: function (a) { return a.au4 > 0.15 && a.au7 > 0.1 && a.au23 > 0.1 && a.au12 < 0.15; },
      conf: function (a) { return (a.au4 * 0.35 + a.au7 * 0.25 + a.au23 * 0.2 + (1 - a.au12) * 0.2); },
    },
    confusion: {
      test: function (a) { return a.au4 > 0.15 && a.au1 > 0.15 && a.au2 > 0.1; },
      conf: function (a) { return (a.au4 * 0.35 + a.au1 * 0.25 + a.au2 * 0.2 + a.au7 * 0.2); },
    },
    disdain: {
      // au9 threshold 0.15→0.10: mild disdain often involves
      // subtle nose wrinkling that should be captured.
      test: function (a) { return a.au9 > 0.10 && a.au15 > 0.08 && a.au7 > 0.08; },
      conf: function (a) { return (a.au9 * 0.35 + a.au15 * 0.25 + a.au7 * 0.2 + a.au14 * 0.2); },
    },
    embarrassment: {
      test: function (a) { return a.au12 > 0.1 && a.au6 > 0.05 && a.au15 > 0.1; },
      conf: function (a) { return (a.au12 * 0.3 + a.au15 * 0.25 + a.au6 * 0.2 + a.au1 * 0.15 + a.au43 * 0.1); },
    },
    pain: {
      // Relaxed from strict 4-AND: au4+au7 core, au9 OR au43 auxiliary.
      // Prkachin (1992): AU4+AU7 are the most reliable pain indicators;
      // AU9 and AU43 are supplementary.
      test: function (a) { return a.au4 > 0.18 && a.au7 > 0.12 && (a.au9 > 0.08 || a.au43 > 0.12); },
      conf: function (a) { return (a.au4 * 0.3 + a.au7 * 0.2 + a.au9 * 0.2 + a.au43 * 0.2 + a.au10 * 0.1); },
    },
    fatigue: {
      test: function (a) { return a.au43 > 0.2 && a.au7 > 0.1 && a.au15 > 0.05 && a.au4 < 0.2; },
      conf: function (a) { return (a.au43 * 0.4 + a.au7 * 0.2 + a.au15 * 0.2 + (1 - a.au5) * 0.2); },
    },
    boredom: {
      test: function (a) { return a.au43 > 0.15 && a.au15 > 0.1 && a.au1 < 0.1 && a.au12 < 0.1; },
      conf: function (a) { return (a.au43 * 0.3 + a.au15 * 0.25 + (1 - a.au1) * 0.2 + (1 - a.au12) * 0.25); },
    },
    interest: {
      test: function (a) { return a.au1 > 0.15 && a.au2 > 0.1 && a.au5 > 0.1 && a.au12 < 0.2; },
      conf: function (a) { return (a.au1 * 0.3 + a.au2 * 0.25 + a.au5 * 0.25 + (1 - a.au12) * 0.2); },
    },
    pleasure: {
      test: function (a) { return a.au12 > 0.2 && a.au6 > 0.1 && a.au25 > 0.1 && a.au43 > 0.1; },
      conf: function (a) { return (a.au12 * 0.3 + a.au6 * 0.25 + a.au25 * 0.2 + a.au43 * 0.15 + a.au7 * 0.1); },
    },
    suppression: {
      test: function (a) { return (a.au23 > 0.2 || a.au24 > 0.2) && a.au4 > 0.1 && a.muscleConflictScore > 0.2; },
      conf: function (a) { return (Math.max(a.au23, a.au24) * 0.35 + a.au4 * 0.2 + a.muscleConflictScore * 0.3 + a.au7 * 0.15); },
    },
    duping_delight: {
      test: function (a) { return a.au12 > 0.15 && a.au14 > 0.1 && a.mouthAsymmetry > 0.12 && a.au7 > 0.1; },
      conf: function (a) { return (a.au12 * 0.25 + a.au14 * 0.2 + a.mouthAsymmetry * 0.3 + a.au7 * 0.15 + a.muscleConflictScore * 0.1); },
    },
    masked_sadness: {
      test: function (a) { return a.au12 > 0.15 && a.au1 > 0.1 && a.au15 > 0.1 && a.muscleConflictScore > 0.15; },
      conf: function (a) { return (a.au12 * 0.2 + a.au1 * 0.2 + a.au15 * 0.2 + a.muscleConflictScore * 0.25 + a.au4 * 0.15); },
    },
    nervous_smile: {
      test: function (a) { return a.au12 > 0.15 && a.au20 > 0.1 && a.au4 > 0.1; },
      conf: function (a) { return (a.au12 * 0.3 + a.au20 * 0.25 + a.au4 * 0.2 + a.au1 * 0.15 + a.au7 * 0.1); },
    },

    /* ── Mild Negative Variants (v3.10) ──
     *  Natural negative emotions are often partial and subtle.
     *  These variants capture low-intensity negative affect that
     *  would otherwise fall below full-expression thresholds.
     *  Ref: Keltner & Haidt (1999), Tracy & Matsumoto (2008)
     */
    irritation: {
      // Mild anger: brow furrow + minor lip/lid tension.
      // Only 2 core AUs required (vs 3 for anger).
      test: function (a) { return a.au4 > 0.12 && (a.au7 > 0.08 || a.au23 > 0.08) && a.au12 < 0.15; },
      conf: function (a) { return (a.au4 * 0.4 + a.au7 * 0.25 + Math.max(a.au23, a.au24) * 0.2 + a.au9 * 0.15); },
    },
    melancholy: {
      // Mild sadness: slight brow raise + lip corner down.
      // 2 core AUs (vs 3 for sadness), lower thresholds.
      test: function (a) { return (a.au1 > 0.08 || a.au4 > 0.06) && a.au15 > 0.06 && a.au12 < 0.15; },
      conf: function (a) { return (a.au1 * 0.3 + a.au15 * 0.3 + a.au4 * 0.2 + a.au17 * 0.2); },
    },
    unease: {
      // Mild fear / low-grade anxiety: brow raise + slight tension.
      // 2 core AUs (vs 3-4 for fear/anxiety).
      // Thresholds raised from 0.08 to 0.10 to avoid false positives
      // during normal thinking/micro-adjustments.
      test: function (a) { return a.au1 > 0.10 && a.au4 > 0.10 && a.au12 < 0.15; },
      conf: function (a) { return (a.au1 * 0.3 + a.au4 * 0.25 + a.au20 * 0.2 + a.au7 * 0.25); },
    },
    distaste: {
      // Mild disgust: subtle nose wrinkle or lip raise.
      // 1 primary AU (vs 2 for disgust), lower threshold.
      test: function (a) { return a.au9 > 0.10 && a.au12 < 0.15; },
      conf: function (a) { return (a.au9 * 0.4 + a.au10 * 0.25 + a.au17 * 0.2 + a.au25 * 0.15); },
    },
  };

  var RULE_KEYS = Object.keys(RULES);

  /* ═══════════════════════════════════════
   *  State Factory
   * ═══════════════════════════════════════ */
  function createState() {
    return {
      prevExpression: 'neutral',
      prevConfidence: 0,
      prevAUs:        null,
      frameCount:     0,
      // Blink tracking
      blinkCount:     0,
      lastBlinkTime:  0,
      // Micro-expression detection
      microLog:       [],
      microCandidate: null,
      // ── NEW: Expression episode tracking ──
      episodeStart:    0,       // timestamp when current expression started
      episodeFrames:   0,       // frames in current expression
      episodePeakConf: 0,       // peak confidence in this episode
      // ── NEW: Transition tracking ──
      transitionLog:     [],    // {from, to, speed, type, authenticity, timestamp}
      transitionMatrix:  {},    // frequency: { 'smile→neutral': count }
      // ── NEW: AU dynamics history ──
      auDynamicsHistory: [],    // last N dynamics snapshots
      // ── NEW: Authenticity tracking ──
      authenticityHistory: [],  // rolling authenticity scores
      lastAuthenticityScore: null,
    };
  }

  /* ═══════════════════════════════════════
   *  Classify Expressions
   * ═══════════════════════════════════════ */
  function classifyExpressions(au) {
    var results = [];
    for (var i = 0; i < RULE_KEYS.length; i++) {
      var key = RULE_KEYS[i];
      var rule = RULES[key];
      if (rule.test(au)) {
        var c = Math.min(1, rule.conf(au));
        if (c > 0.05) results.push({ name: key, confidence: c });
      }
    }
    results.sort(function (a, b) { return b.confidence - a.confidence; });
    return results;
  }

  /* ═══════════════════════════════════════
   *  Multi-Factor Authenticity Engine
   *  Based on Ekman (2003), Porter & ten Brinke (2008)
   * ═══════════════════════════════════════ */
  function analyzeAuthenticity(au, dynamics, exprName, state, now) {
    now = now || Date.now(); // fallback for backward compatibility
    var AC = cfg().AUTHENTICITY;
    var TC = cfg().TEMPORAL;
    var factors = {};

    // Factor 1: Duchenne Marker (orbicularis oculi involvement)
    factors.duchenne = (exprName && exprName.indexOf('smile') >= 0)
      ? au.duchenneScore
      : 0.5; // neutral for non-smile expressions

    // Factor 2: Temporal Profile (FPS-independent, uses real timestamps)
    // Check onset speed if we have dynamics
    var temporalScore = 0.5;
    if (dynamics && state.episodeStart > 0) {
      var onsetMs = now - state.episodeStart;
      if (onsetMs > 0 && onsetMs < 1000) {
        if (onsetMs >= TC.genuineSmileOnsetMin && onsetMs <= TC.genuineSmileOnsetMax) {
          temporalScore = 0.9;
        } else if (onsetMs < TC.fakeSmileOnsetFast) {
          temporalScore = 0.2; // too fast = likely fake
        } else if (onsetMs > TC.fakeSmileOnsetSlow) {
          temporalScore = 0.3; // too slow = deliberate
        } else {
          temporalScore = 0.6;
        }
      }
    }
    factors.temporal = temporalScore;

    // Factor 3: Bilateral Symmetry
    // Genuine expressions tend to be more symmetric (Ekman et al., 1981)
    var asymmetry = au.overallAsymmetry || 0;
    if (asymmetry < AC.asymmetryGenuineMax) {
      factors.symmetry = 1.0 - asymmetry * 3;
    } else if (asymmetry > AC.asymmetryFakedMin) {
      factors.symmetry = Math.max(0, 0.5 - (asymmetry - AC.asymmetryFakedMin) * 3);
    } else {
      factors.symmetry = 0.6;
    }

    // Factor 4: Duration Appropriateness (FPS-independent)
    var durationScore = 0.5;
    var durationMs = state.episodeStart > 0 ? now - state.episodeStart : 0;
    if (durationMs >= TC.genuineDurationMin && durationMs <= TC.genuineDurationMax) {
      durationScore = 0.9;
    } else if (durationMs > TC.genuineDurationMax * 1.5) {
      durationScore = 0.3; // held too long = posed
    } else if (durationMs < TC.genuineDurationMin * 0.5 && durationMs > 100) {
      durationScore = 0.4; // too brief but not micro-expression
    }
    factors.duration = durationScore;

    // Factor 5: Muscle Conflict
    // Low conflict = more genuine
    factors.muscleConflict = 1.0 - (au.muscleConflictScore || 0);

    // Factor 6: Micro-expression Leakage
    // Check recent micro-log for contradictory expressions
    var leakageScore = 1.0;
    if (state.microLog.length > 0) {
      var recentMicros = 0;
      // Use the `now` parameter (resolved at function entry) for deterministic testability
      for (var mi = state.microLog.length - 1; mi >= 0 && mi >= state.microLog.length - 5; mi--) {
        if (now - state.microLog[mi].time < 3000) {
          recentMicros++;
        }
      }
      if (recentMicros > 0) leakageScore = Math.max(0, 1.0 - recentMicros * 0.25);
    }
    factors.leakage = leakageScore;

    // Weighted sum
    var overall =
      factors.duchenne      * AC.duchenneWeight +
      factors.temporal       * AC.temporalWeight +
      factors.symmetry       * AC.symmetryWeight +
      factors.duration       * AC.durationWeight +
      factors.muscleConflict * AC.muscleConflictWeight +
      factors.leakage        * AC.leakageWeight;

    return { overall: Math.min(1, Math.max(0, overall)), factors: factors };
  }

  /* ═══════════════════════════════════════
   *  Transition Analysis
   *  Extracts psychological meaning from expression changes
   * ═══════════════════════════════════════ */
  function analyzeTransition(fromExpr, toExpr, durationMs, au, now) {
    now = now || Date.now(); // fallback for backward compatibility
    var TC = cfg().TRANSITION;
    var type = 'normal';
    var naturalness = 0.5;

    if (durationMs <= TC.abruptMaxMs) {
      type = 'abrupt';
      naturalness = 0.2;
    } else if (durationMs >= TC.smoothMinMs) {
      type = 'smooth';
      naturalness = 0.9;
    } else {
      type = 'normal';
      naturalness = 0.5 + (durationMs - TC.abruptMaxMs) /
        (TC.smoothMinMs - TC.abruptMaxMs) * 0.3;
    }

    // Check for suppressed transition (high muscle conflict during change)
    if (au.muscleConflictScore > 0.3) {
      type = 'suppressed';
      naturalness *= 0.6;
    }

    // Psychological significance of common patterns
    var significance = getTransitionSignificance(fromExpr, toExpr, type);

    return {
      from: fromExpr, to: toExpr,
      durationMs: durationMs, type: type,
      naturalness: naturalness,
      significance: significance,
      timestamp: now,
    };
  }

  function getTransitionSignificance(from, to, type) {
    // Key transition patterns and their psychological meaning
    var _t = function (k) { return (typeof FaceI18n !== 'undefined') ? FaceI18n.t(k) : k; };
    if (from === 'genuine_smile' && to === 'neutral' && type === 'smooth') {
      return _t('trans.genuineToNeutralSmooth');
    }
    if (from === 'social_smile' && to === 'neutral' && type === 'abrupt') {
      return _t('trans.socialToNeutralAbrupt');
    }
    if (from === 'neutral' && (to === 'social_smile' || to === 'genuine_smile') && type === 'abrupt') {
      return _t('trans.neutralToSmileAbrupt');
    }
    if (from === 'genuine_smile' && to === 'contempt') {
      return _t('trans.genuineToContempt');
    }
    if (from === 'social_smile' && to === 'contempt') {
      return _t('trans.socialToContempt');
    }
    if (from === 'anger' && to === 'social_smile') {
      return _t('trans.angerToSocial');
    }
    if (from === 'sadness' && to === 'genuine_smile') {
      return _t('trans.sadnessToGenuine');
    }
    if (from === 'sadness' && to === 'social_smile') {
      return _t('trans.sadnessToSocial');
    }
    if (from === 'suppression' && (to === 'genuine_smile' || to === 'social_smile')) {
      return _t('trans.suppressionToSmile');
    }
    if (from === 'fear' && to === 'social_smile') {
      return _t('trans.fearToSocial');
    }
    if (to === 'suppression') {
      return _t('trans.toSuppression');
    }
    if (from === 'concentration' && to === 'surprise') {
      return _t('trans.concToSurprise');
    }
    if (from === 'neutral' && to === 'anxiety') {
      return _t('trans.neutralToAnxiety');
    }
    // ── Negative-emotion transitions (v3.10.1) ──
    if (from === 'neutral' && to === 'anger') {
      return _t('trans.neutralToAnger');
    }
    if (from === 'neutral' && to === 'sadness') {
      return _t('trans.neutralToSadness');
    }
    if (from === 'neutral' && to === 'disgust') {
      return _t('trans.neutralToDisgust');
    }
    if (from === 'fear' && to === 'anger') {
      return _t('trans.fearToAnger');
    }
    if (from === 'sadness' && to === 'anger') {
      return _t('trans.sadnessToAnger');
    }
    if (from === 'anger' && to === 'sadness') {
      return _t('trans.angerToSadness');
    }
    if (type === 'suppressed') {
      return _t('trans.suppressedType');
    }
    if (type === 'abrupt' && from !== 'neutral' && to !== 'neutral') {
      return _t('trans.abruptNonNeutral');
    }
    return '';
  }

  /* ═══════════════════════════════════════
   *  Main Analysis Pipeline
   * ═══════════════════════════════════════ */
  function analyze(au, state, headPose, auRingBuffers) {
    var PC = cfg().PSYCHOLOGY;
    var now = Date.now();
    state.frameCount++;

    // Classify
    var classified = classifyExpressions(au);
    var topExpr = classified.length > 0 ? classified[0].name : 'neutral';
    var topConf = classified.length > 0 ? classified[0].confidence : 0;

    // ── Capture raw classification BEFORE hysteresis ──
    // Needed for micro-expression detection: hysteresis intentionally
    // suppresses flickers for the stable-expression pathway, but
    // micro-expressions ARE flickers (40–500ms bursts). If we detect
    // after hysteresis, <3-frame expressions are swallowed and the
    // 40ms minimum configured in PSYCHOLOGY.microExpressionMinMs
    // becomes unreachable.
    var rawTopExpr = topExpr;
    var rawTopConf = topConf;

    // ── Compute AU Dynamics (SG-enhanced) ──
    var dynamics = null;
    if (state.prevAUs) {
      dynamics = global.FaceAUDetector.computeAUDynamics(
        state.prevAUs, au, auRingBuffers || null
      );
      state.auDynamicsHistory.push(dynamics);
      if (state.auDynamicsHistory.length > cfg().TEMPORAL.dynamicsHistoryLen) {
        state.auDynamicsHistory.shift();
      }
    }

    // ── Micro-expression Detection (BEFORE hysteresis) ──
    // Uses rawTopExpr so that sub-3-frame flickers are captured as
    // micro-expression candidates. Timing uses Date.now() timestamps,
    // not frame counts, making it FPS-independent.
    if (rawTopExpr !== state.prevExpression && rawTopConf > 0.2) {
      if (!state.microCandidate) {
        state.microCandidate = {
          name: rawTopExpr, confidence: rawTopConf,
          startTime: now, startFrame: state.frameCount,
          prevExpression: state.prevExpression,
        };
      }
    }
    if (state.microCandidate) {
      var microElapsed = now - state.microCandidate.startTime;
      if (rawTopExpr !== state.microCandidate.name || microElapsed > PC.microExpressionMaxMs) {
        if (microElapsed >= PC.microExpressionMinMs && microElapsed <= PC.microExpressionMaxMs) {
          var isLeakage = (state.microCandidate.prevExpression !== 'neutral' &&
                          state.microCandidate.name !== state.microCandidate.prevExpression);
          state.microLog.push({
            expression: state.microCandidate.name,
            confidence: state.microCandidate.confidence,
            durationMs: microElapsed,
            time: now,
            isLeakage: isLeakage,
            context: state.microCandidate.prevExpression,
          });
          if (state.microLog.length > PC.maxMicroLog) state.microLog.shift();
        }
        state.microCandidate = null;
      }
    }

    // ── Expression Temporal Hysteresis ──
    // Prevents flickering: new expression must persist for ≥3 frames
    // before being accepted as a true transition. Standard practice
    // in production AU coders (Cohn et al., 2007).
    // NOTE: micro-expression capture above uses rawTopExpr to bypass this.
    if (topExpr !== state.prevExpression) {
      if (!state._hysteresisCandidate || state._hysteresisCandidate !== topExpr) {
        state._hysteresisCandidate = topExpr;
        state._hysteresisCount = 1;
      } else {
        state._hysteresisCount++;
      }
      // Require 3 consecutive frames of the same new expression
      if (state._hysteresisCount < 3) {
        topExpr = state.prevExpression; // hold previous
        topConf = state.prevConfidence;
      } else {
        state._hysteresisCandidate = null;
        state._hysteresisCount = 0;
      }
    } else {
      state._hysteresisCandidate = null;
      state._hysteresisCount = 0;
    }

    // ── Expression Episode Tracking (FPS-independent) ──
    var transitionInfo = null;
    if (topExpr !== state.prevExpression) {
      // Expression changed — compute real duration in milliseconds
      var episodeDurationMs = state.episodeStart > 0 ? now - state.episodeStart : 0;

      if (state.prevExpression !== 'neutral' || topExpr !== 'neutral') {
        transitionInfo = analyzeTransition(
          state.prevExpression, topExpr, episodeDurationMs, au, now
        );
        state.transitionLog.push(transitionInfo);
        if (state.transitionLog.length > cfg().TRANSITION.maxTransitions) {
          state.transitionLog.shift();
        }
        // Update transition matrix
        var tKey = state.prevExpression + '→' + topExpr;
        state.transitionMatrix[tKey] = (state.transitionMatrix[tKey] || 0) + 1;
      }

      // Reset episode
      state.episodeStart    = now;
      state.episodeFrames   = 0;
      state.episodePeakConf = topConf;
    } else {
      state.episodeFrames++;
      if (topConf > state.episodePeakConf) state.episodePeakConf = topConf;
    }

    // ── Authenticity Analysis ──
    var authenticity = analyzeAuthenticity(au, dynamics, topExpr, state, now);
    state.authenticityHistory.push(authenticity.overall);
    if (state.authenticityHistory.length > 60) state.authenticityHistory.shift();
    state.lastAuthenticityScore = authenticity;

    // ── Blink Detection ──
    if (au.au45 === 1 && now - state.lastBlinkTime > PC.blinkCooldownMs) {
      state.blinkCount++;
      state.lastBlinkTime = now;
    }

    // Update state
    state.prevExpression = topExpr;
    state.prevConfidence = topConf;
    state.prevAUs = au;

    return {
      expressions: classified,
      topExpression: topExpr,
      topConfidence: topConf,
      blinkCount: state.blinkCount,
      microLog: state.microLog,
      // NEW
      authenticity: authenticity,
      transitionInfo: transitionInfo,
      transitionLog: state.transitionLog,
      transitionMatrix: state.transitionMatrix,
      dynamics: dynamics,
      headPose: headPose,
      episodeFrames: state.episodeFrames,
    };
  }

  global.FaceExpressionAnalyzer = Object.freeze({
    createState: createState,
    classifyExpressions: classifyExpressions,
    analyzeAuthenticity: analyzeAuthenticity,
    analyzeTransition: analyzeTransition,
    analyze: analyze,
  });
})(typeof window !== 'undefined' ? window : globalThis);
