/* ═══════════════════════════════════════════════════════════════
 *  face-psychology-engine.js  –  Deep Psychological State v3
 *  Scientific Enhancement:
 *   - 12 psychology dimensions (+ suppressionEffort, emotionalRegulation)
 *   - Cognitive dissonance detection (expression ↔ AU conflict)
 *   - Suppression effort quantification
 *   - Transition-pattern psychological inference
 *   - Baseline deviation analysis
 *   - Deep Chinese analysis text incorporating all signals
 *
 *  References:
 *    Russell (1980) – Circumplex model of affect
 *    Festinger (1957) – Cognitive dissonance theory
 *    Gross (1998) – Emotion regulation strategies
 *    Ekman (2003) – Deception cues in facial expression
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var CFG = null;
  function cfg() { if (!CFG) CFG = global.FaceConfig; return CFG; }
  function t(k) { return global.FaceI18n ? global.FaceI18n.t(k) : k; }
  function el(n) { return global.FaceI18n ? global.FaceI18n.exprLabel(n) : n; }

  /* ── Inline 0–1 clamp (avoids cross-module call overhead) ── */
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  /* ═══ State Factory ═══ */
  function createState() {
    var keys = cfg().PSYCHOLOGY_KEYS;
    var smoothed = {};
    var history  = {};
    var baseline = {};
    for (var i = 0; i < keys.length; i++) {
      smoothed[keys[i]] = (keys[i] === 'authenticity' || keys[i] === 'emotionalRegulation') ? 0.5 : 0;
      history[keys[i]]  = [];
      baseline[keys[i]] = null;
    }
    return {
      smoothed:            smoothed,
      history:             history,
      baseline:            baseline,
      baselineFrames:      0,
      baselineLocked:      false,
      analysisText:        '',
      // NEW: Cognitive dissonance tracking
      dissonanceHistory:   [],
      // NEW: Emotional inertia (how resistant to change)
      inertiaScore:        0.5,
      // NEW: Regulation style
      regulationStyle:     '',
    };
  }

  /* ═══ Compute Raw Dimensions from AUs & Analysis ═══ */
  function computeRaw(au, analysis) {
    var expr  = analysis.topExpression;
    var conf  = analysis.topConfidence;
    var auth  = analysis.authenticity;
    var trans = analysis.transitionInfo;

    // ── Valence (positive/negative) ──
    // Based on Russell (1980) circumplex model of affect.
    // Each expression maps to a valence coefficient scaled by confidence.
    // Raw valence range: [-1, +1], normalized to [0, 1] below.
    var valence = 0;
    if (expr === 'genuine_smile' || expr === 'pleasure')   valence =  conf * 0.9;
    else if (expr === 'social_smile')                      valence =  conf * 0.4;
    else if (expr === 'suppressed_smile')                  valence =  conf * 0.3;
    else if (expr === 'interest')                          valence =  conf * 0.5;
    else if (expr === 'duping_delight')                    valence =  conf * 0.2;
    else if (expr === 'sadness' || expr === 'masked_sadness') valence = -conf * 0.8;
    else if (expr === 'anger')                             valence = -conf * 0.9;
    else if (expr === 'disgust' || expr === 'contempt')    valence = -conf * 0.7;
    else if (expr === 'fear')                              valence = -conf * 0.85;
    else if (expr === 'pain')                              valence = -conf * 0.8;
    else if (expr === 'disdain')                           valence = -conf * 0.5;
    else if (expr === 'anxiety')                           valence = -conf * 0.6;
    else if (expr === 'tension')                            valence = -conf * 0.5;
    else if (expr === 'suppression')                        valence = -conf * 0.3;
    else if (expr === 'embarrassment')                      valence = -conf * 0.3;
    else if (expr === 'boredom')                            valence = -conf * 0.3;
    else if (expr === 'fatigue')                            valence = -conf * 0.2;
    else if (expr === 'confusion')                          valence = -conf * 0.2;
    else if (expr === 'nervous_smile')                      valence = -conf * 0.2;
    // Mild negative variants (v3.10)
    else if (expr === 'irritation')                         valence = -conf * 0.5;
    else if (expr === 'melancholy')                         valence = -conf * 0.45;
    else if (expr === 'unease')                             valence = -conf * 0.35;
    else if (expr === 'distaste')                           valence = -conf * 0.4;
    // surprise → 0 (Russell 1980: near-zero valence, high arousal)
    // concentration → 0 (neutral valence, no mapping needed)
    valence = (valence + 1) * 0.5; // normalize to 0-1

    // ── Arousal (intensity) ──
    var arousal = 0;
    var auSum = (au.au1 + au.au2 + au.au4 + au.au5 + au.au6 +
                 au.au7 + au.au9 + au.au12 + au.au20 + au.au26) * 0.1;
    arousal = clamp01(auSum + conf * 0.3);

    // ── Cognitive Load ──
    var cognitiveLoad = 0;
    cognitiveLoad = au.au4 * 0.3 + au.au7 * 0.2 + au.au1 * 0.15 +
      au.au23 * 0.15 + (au.muscleConflictScore || 0) * 0.2;
    cognitiveLoad = clamp01(cognitiveLoad);

    // ── Stress ──
    var stress = 0;
    stress = au.au4 * 0.2 + au.au7 * 0.15 + au.au20 * 0.15 +
      au.au23 * 0.15 + au.au24 * 0.1 + (au.overallAsymmetry || 0) * 0.15 +
      (au.muscleConflictScore || 0) * 0.1;
    stress = clamp01(stress);

    // ── Confidence ──
    var confidence = 0;
    confidence = (1 - au.au1 * 0.3) * (1 - au.au4 * 0.2) *
      (1 - au.au15 * 0.2) * (1 - au.au20 * 0.15) *
      (au.au12 > 0.2 ? 1.2 : 1);
    confidence = clamp01(confidence);

    // ── Engagement ──
    var engagement = 0;
    engagement = au.au5 * 0.2 + au.au1 * 0.15 + au.au2 * 0.15 +
      au.au12 * 0.15 + (1 - au.au43) * 0.2 + conf * 0.15;
    engagement = clamp01(engagement);

    // ── Comfort ──
    var comfort = 0;
    comfort = (1 - stress) * 0.4 + (1 - au.au4 * 0.5) * 0.2 +
      (1 - au.muscleConflictScore) * 0.2 + (1 - au.overallAsymmetry) * 0.2;
    comfort = clamp01(comfort);

    // ── Authenticity (from Authenticity Engine) ──
    var authenticity = auth ? auth.overall : 0.5;

    // ── Tension ──
    var tension = 0;
    tension = au.au4 * 0.2 + au.au7 * 0.2 + au.au23 * 0.15 +
      au.au24 * 0.15 + (au.corrugatorAvg ? (0.12 - au.corrugatorAvg) * 5 : 0) * 0.15 +
      (au.muscleConflictScore || 0) * 0.15;
    tension = clamp01(tension);

    // ── Deception (enhanced with temporal cues – Ekman, 2003) ──
    // Deception cues: low authenticity, muscle conflict, asymmetry,
    // AND temporal anomalies (too-fast onset, too-long hold duration).
    var deception = 0;
    var temporalDeceptionCue = 0;
    if (trans) {
      // Too-fast onset → likely deliberate (Ekman, 2003)
      if (trans.naturalness < 0.3) temporalDeceptionCue += 0.3;
      // Abrupt transitions between non-neutral expressions → unusual
      if (trans.type === 'abrupt' && trans.from !== 'neutral' && trans.to !== 'neutral') {
        temporalDeceptionCue += 0.2;
      }
    }
    deception = (1 - authenticity) * 0.25 +
      (au.muscleConflictScore || 0) * 0.15 +
      (au.overallAsymmetry || 0) * 2 * 0.15 +
      (au.mouthAsymmetry || 0) * 0.1 +
      temporalDeceptionCue * 0.2 +
      (expr === 'duping_delight' ? conf * 0.8 : 0) * 0.15;
    deception = clamp01(deception);

    // ── NEW: Suppression Effort ──
    // Quantifies how hard the subject is working to suppress emotions
    var suppressionEffort = 0;
    suppressionEffort = (au.au23 + au.au24) * 0.3 +    // lip tightening/pressing
      (au.muscleConflictScore || 0) * 0.3 +              // antagonist muscle activation
      au.au14 * 0.15 +                                   // dimpler (suppression indicator)
      au.au7 * 0.15 +                                    // lid tightener
      (au.au4 > 0.15 && au.au12 > 0.15 ? 0.3 : 0) * 0.1; // brow+smile conflict
    suppressionEffort = clamp01(suppressionEffort);

    // ── NEW: Emotional Regulation ──
    // How effectively the subject regulates emotions (smooth transitions, stable baseline)
    var emotionalRegulation = 0.5;
    if (trans) {
      // Smooth transitions = better regulation
      emotionalRegulation = trans.naturalness * 0.4 + (1 - au.muscleConflictScore) * 0.3 +
        (1 - stress * 0.5) * 0.3;
    } else {
      emotionalRegulation = (1 - au.muscleConflictScore) * 0.4 +
        (1 - stress * 0.3) * 0.3 + 0.3; // baseline
    }
    emotionalRegulation = clamp01(emotionalRegulation);

    return {
      valence: valence, arousal: arousal, cognitiveLoad: cognitiveLoad,
      stress: stress, confidence: confidence, engagement: engagement,
      comfort: comfort, authenticity: authenticity, tension: tension,
      deception: deception, suppressionEffort: suppressionEffort,
      emotionalRegulation: emotionalRegulation,
    };
  }

  /* ═══ Smooth & Update History ═══ */
  function smoothAndRecord(state, raw) {
    var PC  = cfg().PSYCHOLOGY;
    var keys = cfg().PSYCHOLOGY_KEYS;
    var alpha = PC.smoothingAlpha;

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      state.smoothed[k] = state.smoothed[k] + alpha * (raw[k] - state.smoothed[k]);
      state.history[k].push(state.smoothed[k]);
      if (state.history[k].length > PC.historyLength) state.history[k].shift();
    }
  }

  /* ═══ Baseline Learning (neutral-gated) ═══
   *  Only accumulates frames where the subject shows a near-neutral,
   *  low-conflict face. This prevents initial strong expressions
   *  (e.g. greeting smile) from polluting the personal baseline.
   *  Ref: Ekman & Friesen (1978) – AU coding from individual neutral.
   */
  function updateBaseline(state, analysis) {
    if (state.baselineLocked) return;
    var PC   = cfg().PSYCHOLOGY;
    var keys = cfg().PSYCHOLOGY_KEYS;

    // Gate: only count neutral / low-conflict frames toward baseline
    var expr = analysis ? analysis.topExpression : 'neutral';
    var conflict = analysis && analysis.authenticity
      ? (analysis.authenticity.factors.muscleConflict !== undefined
        ? 1 - analysis.authenticity.factors.muscleConflict : 0)
      : 0;
    if (expr === 'neutral' && conflict < 0.15) {
      state.baselineFrames++;
    }

    if (state.baselineFrames >= PC.baselineFrames) {
      state.baselineLocked = true;
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var arr = state.history[k];
        if (arr.length > 0) {
          var sum = 0;
          for (var j = 0; j < arr.length; j++) sum += arr[j];
          state.baseline[k] = sum / arr.length;
        }
      }
    }
  }

  /* ═══ Cognitive Dissonance Detection ═══
   *  When current expression conflicts with underlying AU patterns.
   *  v3.10.1: Added negative-emotion dissonance checks.
   *  Previously all 4 specific checks were smile-biased.
   */
  function detectCognitiveDissonance(au, analysis) {
    var dissonance = 0;
    var details = [];
    var expr = analysis.topExpression;

    // ── Smile-related dissonance ──
    // Smiling but brow furrowed + lip pressed
    if ((expr === 'genuine_smile' || expr === 'social_smile') && au.au4 > 0.25) {
      dissonance += 0.4;
      details.push(t('analysis.smileBrowFurrow'));
    }
    // Smiling but lip pressed (suppression leak)
    if (expr.indexOf('smile') >= 0 && (au.au23 > 0.25 || au.au24 > 0.25)) {
      dissonance += 0.3;
      details.push(t('analysis.smileLipPress'));
    }
    // Happy expression but asymmetric
    if (expr.indexOf('smile') >= 0 && au.overallAsymmetry > 0.2) {
      dissonance += 0.2;
      details.push(t('analysis.smileAsymmetric'));
    }

    // ── Negative-emotion dissonance (v3.10.1) ──
    // Angry/disgusted face but mouth corners lifted (smile leak)
    // Ekman (2003): involuntary smile AUs during deliberate negative display
    if ((expr === 'anger' || expr === 'disgust' || expr === 'irritation') && au.au12 > 0.2) {
      dissonance += 0.35;
      details.push(t('analysis.negativeSmileLeak'));
    }
    // Sad face but cheek raise (AU6) without lip corner depression deepening
    // Indicates possible posed sadness (genuine sadness lacks AU6 activation)
    if ((expr === 'sadness' || expr === 'melancholy') && au.au6 > 0.2) {
      dissonance += 0.3;
      details.push(t('analysis.sadnessWithCheekRaise'));
    }
    // Fear expression but chin raised and lip pressed (control signals)
    // Genuine fear lacks AU17+AU24 which indicate deliberate composure
    if ((expr === 'fear' || expr === 'unease') && au.au17 > 0.2 && au.au24 > 0.2) {
      dissonance += 0.3;
      details.push(t('analysis.fearWithControl'));
    }

    // ── General dissonance ──
    // Neutral face but high arousal AUs
    if (expr === 'neutral' && (au.au4 > 0.3 || au.au7 > 0.3)) {
      dissonance += 0.3;
      details.push(t('analysis.calmButTense'));
    }
    // High muscle conflict indicates potential dissonance
    if (au.muscleConflictScore > 0.3) {
      dissonance += au.muscleConflictScore * 0.3;
      details.push(t('analysis.antagonistMuscle'));
    }

    return {
      score: Math.min(1, dissonance),
      details: details,
    };
  }

  /* ═══ Emotional Inertia ═══
   *  How resistant to change the emotional state is
   *  High inertia = emotions persist, low = rapid shifts
   */
  function computeEmotionalInertia(state, analysis) {
    var transLog = analysis.transitionLog || [];
    if (transLog.length < 2) return 0.5;

    var TC = cfg().TRANSITION;
    var recent = transLog.slice(-Math.min(transLog.length, TC.inertiaWindow));
    // Count transitions in recent window
    var transCount = recent.length;
    // More transitions = less inertia
    var inertia = Math.max(0, 1 - transCount / TC.inertiaWindow * 2);
    return inertia;
  }

  /* ═══ Regulation Style Classification ═══
   *  Gross (1998): Antecedent-focused vs Response-focused regulation
   */
  function classifyRegulationStyle(state, au, analysis) {
    var transLog = analysis.transitionLog || [];
    var suppressionEffort = state.smoothed.suppressionEffort || 0;
    var authenticity = state.smoothed.authenticity || 0.5;

    // Check recent transition patterns
    var suppressedCount = 0;
    var smoothCount = 0;
    var recentTrans = transLog.slice(-10);
    for (var i = 0; i < recentTrans.length; i++) {
      if (recentTrans[i].type === 'suppressed') suppressedCount++;
      if (recentTrans[i].type === 'smooth') smoothCount++;
    }

    if (suppressionEffort > 0.5 && suppressedCount > 2) {
      return t('reg.suppressive');
    }
    if (smoothCount > suppressedCount && authenticity > 0.6) {
      return t('reg.adaptive');
    }
    if (au.muscleConflictScore > 0.3 && authenticity < 0.4) {
      return t('reg.masking');
    }
    if (suppressionEffort < 0.2 && authenticity > 0.7) {
      return t('reg.expressive');
    }
    return t('reg.mixed');
  }

  /* ═══ Analysis Text Builders (modular) ═══
   *  Each builder appends lines for its domain.
   *  Extracted from generateAnalysis for maintainability.
   */
  function _buildAuthenticity(lines, expr, analysis) {
    var authScore = analysis.authenticity ? analysis.authenticity.overall : 0.5;
    var authText = authScore > 0.7 ? t('analysis.authReal')
      : authScore > 0.4 ? t('analysis.authSuspect') : t('analysis.authFake');
    var exprLabel = el(expr);
    lines.push(t('analysis.currentExpr') + exprLabel +
      t('p.lp') + t('analysis.confidence') + ' ' + (analysis.topConfidence * 100).toFixed(0) + '%' + t('p.comma') +
      t('analysis.authenticity') + ': ' + authText + ' ' + (authScore * 100).toFixed(0) + '%' + t('p.rp'));

    if (analysis.authenticity && analysis.authenticity.factors) {
      var f = analysis.authenticity.factors;
      var authDetails = [];
      if (f.duchenne < 0.3 && expr.indexOf('smile') >= 0) authDetails.push(t('analysis.noDuchenne'));
      if (f.temporal < 0.4) authDetails.push(t('analysis.temporalAnomaly'));
      if (f.symmetry < 0.4) authDetails.push(t('analysis.asymmetry'));
      if (f.muscleConflict < 0.5) authDetails.push(t('analysis.muscleConflict'));
      if (f.leakage < 0.7) authDetails.push(t('analysis.leakageDetected'));
      if (authDetails.length > 0) {
        lines.push('  ' + t('analysis.authWarning') + authDetails.join(t('p.semi')));
      }
    }
  }

  function _buildDissonance(lines, state) {
    var dissonance = state._lastDissonance;
    if (dissonance && dissonance.score > 0.2) {
      lines.push(t('analysis.dissonance') +
        (dissonance.score > 0.5 ? t('analysis.dissonanceHigh') : t('analysis.dissonanceMild')) +
        ' — ' + dissonance.details.join(t('p.comma')));
    }
  }

  function _buildTransition(lines, analysis) {
    if (analysis.transitionInfo) {
      var ti = analysis.transitionInfo;
      var fromLabel = el(ti.from);
      var toLabel = el(ti.to);
      lines.push(t('analysis.transition') + fromLabel + ' → ' + toLabel +
        t('p.lp') + ti.type + t('p.comma') + ti.durationMs + 'ms' + t('p.rp'));
      if (ti.significance) {
        lines.push('  ▸ ' + ti.significance);
      }
    }
  }

  function _buildDimensions(lines, s) {
    var dimLines = [];
    if (s.valence < 0.3)       dimLines.push(t('analysis.negativeValence'));
    else if (s.valence > 0.7)  dimLines.push(t('analysis.positiveValence'));
    if (s.arousal > 0.6)       dimLines.push(t('analysis.highArousal'));
    if (s.cognitiveLoad > 0.5) dimLines.push(t('analysis.highCogLoad'));
    if (s.stress > 0.5)        dimLines.push(t('analysis.stressSign'));
    if (s.tension > 0.5)       dimLines.push(t('analysis.facialTension'));
    if (s.deception > 0.4)     dimLines.push(t('analysis.deceptionSignal'));
    if (s.suppressionEffort > 0.4) dimLines.push(t('analysis.suppressing'));
    if (s.comfort < 0.3)       dimLines.push(t('analysis.lowComfort'));
    if (dimLines.length > 0) {
      lines.push(t('analysis.psyState') + dimLines.join(t('p.comma')));
    }
  }

  function _buildSuppression(lines, s, au) {
    if (s.suppressionEffort > 0.3) {
      var suppDetail = [];
      if (au.au23 > 0.2 || au.au24 > 0.2) suppDetail.push(t('analysis.lipTight'));
      if (au.au4 > 0.2 && au.au12 > 0.15) suppDetail.push(t('analysis.browSmile'));
      if (au.muscleConflictScore > 0.2) suppDetail.push(t('analysis.antagonist'));
      lines.push(t('analysis.suppression') +
        (s.suppressionEffort > 0.6 ? t('analysis.suppressStrong') : t('analysis.suppressMid')) +
        t('analysis.suppressWord') + (suppDetail.length > 0 ? t('p.lp') + suppDetail.join(t('p.comma')) + t('p.rp') : ''));
    }
  }

  function _buildMicroExpressions(lines, analysis) {
    var microLog = analysis.microLog || [];
    if (microLog.length > 0) {
      var recentMicros = [];
      var now = Date.now();
      for (var mi = microLog.length - 1; mi >= 0 && recentMicros.length < 3; mi--) {
        if (now - microLog[mi].time < 10000) {
          var mLabel = el(microLog[mi].expression);
          var leakTag = microLog[mi].isLeakage ? '[' + t('leakage') + ']' : '';
          recentMicros.push(mLabel + leakTag + '(' + microLog[mi].durationMs + 'ms)');
        }
      }
      if (recentMicros.length > 0) {
        lines.push(t('analysis.microExpr') + recentMicros.join(t('p.comma')));
      }
    }
  }

  function _buildHeadPose(lines, analysis) {
    if (analysis.headPose) {
      var hp = analysis.headPose;
      var poseNotes = [];
      if (Math.abs(hp.yaw) > 15) poseNotes.push(hp.yaw > 0 ? t('analysis.headLeft') : t('analysis.headRight'));
      if (hp.pitch > 15) poseNotes.push(t('analysis.headDown'));
      if (hp.pitch < -10) poseNotes.push(t('analysis.headUp'));
      if (Math.abs(hp.roll) > 10) poseNotes.push(t('analysis.headTilt'));
      if (poseNotes.length > 0) {
        lines.push(t('analysis.headPose') + poseNotes.join(t('p.comma')));
      }
    }
  }

  function _buildBlinkAnalysis(lines, blinkAnalysis) {
    if (blinkAnalysis && blinkAnalysis.rate > 0) {
      var br = blinkAnalysis.rate;
      var brNote = '';
      if (br > 35)      brNote = t('analysis.blinkVeryHigh');
      else if (br > 25) brNote = t('analysis.blinkHigh');
      else if (br > 20) brNote = t('analysis.blinkSlightHigh');
      else if (br >= 10) brNote = t('analysis.blinkNormal');
      else               brNote = t('analysis.blinkLow');
      lines.push(t('analysis.blinkAnalysis') + br.toFixed(1) + t('analysis.blinkPerMin') + ' (' + brNote + ')');
      if (blinkAnalysis.perclos > 0.08) {
        var percPct = (blinkAnalysis.perclos * 100).toFixed(0);
        var percWarn = blinkAnalysis.perclos > 0.15 ? t('analysis.perclosExceed') : t('analysis.perclosNear');
        lines.push('  ▸ PERCLOS=' + percPct + '% — ' + percWarn + t('analysis.perclosRef'));
      }
      if (blinkAnalysis.clusters > 2) {
        lines.push('  ▸ ' + t('analysis.blinkCluster') + '(' + blinkAnalysis.clusters + t('analysis.blinkClusterNote'));
      }
      if (blinkAnalysis.ibiVariance > 0.4) {
        lines.push('  ▸ ' + t('analysis.ibiHigh') + '(CV=' + blinkAnalysis.ibiVariance.toFixed(2) + ')' + t('analysis.ibiNote'));
      }
    }
  }

  /* ═══ Generate Deep Analysis Text ═══ */
  function generateAnalysis(state, au, analysis, blinkAnalysis) {
    var s = state.smoothed;
    var lines = [];
    var expr = analysis.topExpression;

    _buildAuthenticity(lines, expr, analysis);
    _buildDissonance(lines, state);
    _buildTransition(lines, analysis);
    _buildDimensions(lines, s);
    _buildSuppression(lines, s, au);

    // ── Emotional regulation style ──
    state.regulationStyle = classifyRegulationStyle(state, au, analysis);
    lines.push(t('analysis.regulation') + state.regulationStyle);

    // ── Emotional inertia ──
    state.inertiaScore = computeEmotionalInertia(state, analysis);
    if (state.inertiaScore < 0.3) {
      lines.push(t('analysis.inertia') + t('analysis.inertiaLow'));
    } else if (state.inertiaScore > 0.7) {
      lines.push(t('analysis.inertia') + t('analysis.inertiaHigh'));
    }

    // ── Baseline deviation ──
    if (state.baselineLocked) {
      var deviations = [];
      var keys = cfg().PSYCHOLOGY_KEYS;
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (state.baseline[k] !== null) {
          var delta = s[k] - state.baseline[k];
          if (Math.abs(delta) > 0.2) {
            var label = global.FaceI18n ? global.FaceI18n.psyLabel(k)
              : cfg().PSYCHOLOGY_LABELS[k];
            deviations.push(label + (delta > 0 ? '↑' : '↓') +
              Math.abs(delta * 100).toFixed(0) + '%');
          }
        }
      }
      if (deviations.length > 0) {
        lines.push(t('analysis.baselineDeviation') + deviations.join(t('p.comma')));
      }
    }

    _buildMicroExpressions(lines, analysis);
    _buildHeadPose(lines, analysis);
    _buildBlinkAnalysis(lines, blinkAnalysis);

    return lines.join('\n');
  }

  /* ═══ Main Update Pipeline ═══ */
  function update(state, au, analysis, blinkAnalysis) {
    var raw = computeRaw(au, analysis);

    // ── Blink-rate & PERCLOS modulation ──
    if (blinkAnalysis) {
      var rate = blinkAnalysis.rate || 0;
      var perclos = blinkAnalysis.perclos || 0;
      // Elevated blink rate (>25/min) correlates with stress & cognitive load
      if (rate > 25) {
        var excess = Math.min((rate - 25) / 30, 0.35);
        raw.stress        = Math.min(1, raw.stress        + excess);
        raw.cognitiveLoad = Math.min(1, raw.cognitiveLoad + excess * 0.8);
        raw.tension       = Math.min(1, raw.tension       + excess * 0.5);
      }
      // Very low blink rate (<10/min) may indicate intense focus or dissociation
      if (rate > 0 && rate < 10) {
        raw.engagement    = Math.min(1, raw.engagement    + 0.15);
        raw.cognitiveLoad = Math.min(1, raw.cognitiveLoad + 0.10);
      }
      // High IBI coefficient of variation suggests irregular arousal pattern
      if (blinkAnalysis.ibiVariance > 0.4) {
        raw.arousal = Math.min(1, raw.arousal + 0.1);
      }
      // PERCLOS > 0.15 = gold-standard drowsiness (Dinges et al., 1998)
      // Reduces engagement, increases comfort (relaxation), lowers arousal
      if (perclos > 0.08) {
        var drowsinessEffect = Math.min((perclos - 0.08) / 0.20, 0.5);
        raw.engagement = Math.max(0, raw.engagement - drowsinessEffect * 0.6);
        raw.arousal    = Math.max(0, raw.arousal    - drowsinessEffect * 0.4);
        raw.stress     = Math.max(0, raw.stress     - drowsinessEffect * 0.2);
      }
    }

    smoothAndRecord(state, raw);
    updateBaseline(state, analysis);

    // ── Persist cognitive dissonance trend ──
    var dissonance = detectCognitiveDissonance(au, analysis);
    state.dissonanceHistory.push(dissonance.score);
    if (state.dissonanceHistory.length > cfg().PSYCHOLOGY.historyLength) {
      state.dissonanceHistory.shift();
    }
    state._lastDissonance = dissonance; // cache for generateAnalysis

    state.analysisText = generateAnalysis(state, au, analysis, blinkAnalysis);
    return state;
  }

  global.FacePsychologyEngine = Object.freeze({
    createState:               createState,
    computeRaw:                computeRaw,
    update:                    update,
    detectCognitiveDissonance: detectCognitiveDissonance,
    computeEmotionalInertia:   computeEmotionalInertia,
  });
})(typeof window !== 'undefined' ? window : globalThis);
