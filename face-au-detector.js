/* ═══════════════════════════════════════════════════════════════
 *  face-au-detector.js  –  FACS Action Unit Detection v3
 *  Scientific Enhancement:
 *   - 20 AUs with bilateral measurements
 *   - Temporal dynamics (velocity, acceleration, onset/offset)
 *   - Bilateral asymmetry per AU
 *   - Muscle synergy & conflict detection
 *   - Head pose estimation
 *   - Periorbital (Duchenne) analysis
 *
 *  References:
 *    Ekman & Friesen (1978) – FACS
 *    Ekman (2003) – Duchenne smile markers
 *    Ekman et al. (1981) – Facial asymmetry
 *    Cohn & Schmidt (2004) – AU onset/offset timing
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var CFG = null;
  var H   = null;

  function cfg() { if (!CFG) CFG = global.FaceConfig; return CFG; }
  function hlp() { if (!H) H = global.FaceHelpers; return H; }

  /* ── Module-level constant key lists (avoid per-frame allocation) ── */
  var SMOOTH_RAW_KEYS = [
    'earLeft','earRight','earAvg','earDiff','mar','mouthWidth',
    'lipThickness','faceW','faceH','duchenneScore','periorbitalAvg',
    'overallAsymmetry','browAsymmetry','eyeAsymmetry','mouthAsymmetry',
    'cheekAsymmetry','muscleConflictScore','corrugatorAvg','nasolabialAvg',
  ];
  var SMOOTH_BILATERAL_KEYS = [
    'au1_right','au1_left','au2_right','au2_left',
    'au6_right','au6_left','au12_right','au12_left',
    'au15_right','au15_left','rPeriorbDensity','lPeriorbDensity',
  ];

  /* ── EAR (Eye Aspect Ratio) – occlusion-robust ── */
  function computeRobustEAR(lm, eyeIdx) {
    var p = [];
    for (var i = 0; i < eyeIdx.length; i++) p.push(lm[eyeIdx[i]]);
    var h1 = hlp().dist(p[1], p[5]);
    var h2 = hlp().dist(p[2], p[4]);
    var w  = hlp().dist(p[0], p[3]) || 0.001;
    return (h1 + h2) / (2 * w);
  }

  /* ── 14-Point Robust EAR (uses upper+lower eyelid strips) ──
   *  Averages 7-point upper and lower lid distances for better
   *  occlusion resistance (glasses, hair). Falls back to 6-point
   *  EAR if landmarks are missing.
   */
  function computeRobustEAR14(lm, upperIdx, lowerIdx, outerIdx, innerIdx) {
    if (!upperIdx || !lowerIdx || upperIdx.length < 5 || lowerIdx.length < 5) {
      // fallback to 6-point EAR
      return null;
    }
    var w = hlp().dist(lm[outerIdx], lm[innerIdx]) || 0.001;
    var totalH = 0;
    var pairs = Math.min(upperIdx.length, lowerIdx.length);
    // Skip first and last (they are near the corners)
    var count = 0;
    for (var i = 1; i < pairs - 1; i++) {
      totalH += hlp().dist(lm[upperIdx[i]], lm[lowerIdx[i]]);
      count++;
    }
    return count > 0 ? (totalH / count) / w : null;
  }

  /* ── Head-Pose-Compensated Distance ──
   *  Corrects for foreshortening when head is turned/tilted.
   *  Applies cosine compensation based on yaw and pitch.
   *  Reference: Prince (2012) – Geometric distortion in face analysis.
   */
  function poseCompensatedDist(rawDist, headPose) {
    if (!headPose) return rawDist;
    var yawRad = (headPose.yaw || 0) * Math.PI / 180;
    var pitchRad = (headPose.pitch || 0) * Math.PI / 180;
    // Horizontal distances shrink with yaw, vertical with pitch
    var cosYaw = Math.cos(yawRad);
    var cosPitch = Math.cos(pitchRad);
    // Combined compensation (geometric mean to avoid over-correction)
    var factor = Math.sqrt(Math.abs(cosYaw * cosPitch)) || 0.5;
    return rawDist / Math.max(factor, 0.5); // cap at 2x correction
  }

  /* ═══ Per-User Adaptive AU Calibration ═══
   *  FACS gold standard: AUs are coded as deviations from the
   *  individual's neutral face (Ekman & Friesen, 1978).
   *  Accumulates neutral-face measurements over first N frames,
   *  then adjusts AU thresholds to the user's personal baseline.
   */
  function _median(values) {
    if (!values || !values.length) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) * 0.5;
  }

  function _mad(values, center) {
    var deviations = [];
    for (var i = 0; i < values.length; i++) deviations.push(Math.abs(values[i] - center));
    return _median(deviations);
  }

  function createCalibrator(calibFrames, options) {
    calibFrames = calibFrames || 60;
    options = options || {};
    var samples = {};
    var accepted = 0;
    var rejected = 0;
    var adapted = 0;
    var locked = false;
    var baseline = null;
    var minQuality = options.minQuality == null ? 0.55 : options.minQuality;
    var adaptQuality = options.adaptQuality == null ? 0.78 : options.adaptQuality;
    var neutralActivityMax = options.neutralActivityMax == null ? 0.16 : options.neutralActivityMax;
    var driftAlpha = options.driftAlpha == null ? 0.002 : options.driftAlpha;

    function isOutlier(measurements) {
      if (accepted < Math.min(12, Math.max(5, Math.floor(calibFrames * 0.25)))) return false;
      var keys = Object.keys(measurements);
      var violations = 0;
      var checked = 0;
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var values = samples[key];
        if (!values || values.length < 5 || typeof measurements[key] !== 'number') continue;
        checked++;
        var center = _median(values);
        var scale = Math.max(_mad(values, center) * 1.4826, Math.abs(center) * 0.01, 0.0005);
        if (Math.abs(measurements[key] - center) > scale * 6) violations++;
      }
      return checked > 0 && violations >= Math.max(2, Math.ceil(checked * 0.25));
    }

    function lockBaseline() {
      baseline = {};
      var mad = {};
      var keys = Object.keys(samples);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (!samples[key].length) continue;
        baseline[key] = _median(samples[key]);
        mad[key] = _mad(samples[key], baseline[key]);
      }
      baseline._mad = mad;
      locked = true;
      samples = {};
    }

    function observe(measurements, meta) {
      meta = meta || {};
      var quality = meta.quality && typeof meta.quality.score === 'number' ? meta.quality.score : 1;
      if ((meta.quality && meta.quality.action === 'pause') || quality < minQuality) {
        rejected++;
        return false;
      }

      if (!locked) {
        if (isOutlier(measurements)) {
          rejected++;
          return false;
        }
        var keys = Object.keys(measurements);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (typeof measurements[key] !== 'number' || !Number.isFinite(measurements[key])) continue;
          if (!samples[key]) samples[key] = [];
          samples[key].push(measurements[key]);
        }
        accepted++;
        if (accepted >= calibFrames) lockBaseline();
        return true;
      }

      var activity = typeof meta.activity === 'number' ? meta.activity : Infinity;
      if (quality < adaptQuality || activity > neutralActivityMax) return false;
      var baselineKeys = Object.keys(measurements);
      for (var j = 0; j < baselineKeys.length; j++) {
        var name = baselineKeys[j];
        var value = measurements[name];
        if (typeof value !== 'number' || typeof baseline[name] !== 'number') continue;
        var noise = Math.max((baseline._mad[name] || 0) * 1.4826, Math.abs(baseline[name]) * 0.005, 0.0003);
        var residual = value - baseline[name];
        var clipped = Math.max(-noise * 3, Math.min(noise * 3, residual));
        baseline[name] += driftAlpha * clipped;
        baseline._mad[name] += driftAlpha * (Math.abs(residual) - baseline._mad[name]);
      }
      adapted++;
      return true;
    }

    return {
      isLocked: function () { return locked; },
      getBaseline: function () { return baseline; },
      getStatus: function () {
        var total = accepted + rejected;
        return {
          locked: locked,
          accepted: accepted,
          rejected: rejected,
          adapted: adapted,
          confidence: locked ? Math.max(0.55, Math.min(1, accepted / Math.max(calibFrames, 1) * (1 - rejected / Math.max(total, 1)))) : accepted / calibFrames * 0.55,
        };
      },
      observe: observe,
      accumulate: function (measurements) { return observe(measurements, {}); },
    };
  }

  /* ── MAR (Mouth Aspect Ratio, with head-pose compensation) ── */
  function computeMAR(lm, headPose) {
    var L = cfg().LANDMARKS;
    var top = lm[L.innerLipTop], bot = lm[L.innerLipBottom];
    var left = lm[L.innerMouthLeft], right = lm[L.innerMouthRight];
    var h = hlp().dist(top, bot);
    var w = poseCompensatedDist(hlp().dist(left, right), headPose) || 0.001;
    return h / w;
  }

  /* ── Calibration Shift (module-level, no per-frame closure) ──
   *  Only recalibrates if deviation exceeds noise floor (1.5× MAD).
   *  Returns null when baseline key is missing, 0 when within noise,
   *  or the calibrated AU value. */
  function _calibShift(clampFn, current, key, gain, bl, madData) {
    var base = bl[key];
    if (typeof base !== 'number') return null;
    var threshold = (madData[key] || 0) * 1.5;
    var shift = current - base;
    if (Math.abs(shift) < threshold) return 0;
    return clampFn((shift > 0 ? shift - threshold : shift + threshold) * gain, 0, 1);
  }

  /* ═══ Core AU Computation with bilateral measurements ═══ */
  function computeAUs(lm, calibrator, headPose, quality) {
    var L = cfg().LANDMARKS;
    var h = hlp();
    var d = h.dist, cl = h.clamp;

    // Reference distances (with head-pose compensation)
    var rawFaceW = d(lm[L.leftFace], lm[L.rightFace]) || 0.001;
    var rawFaceH = d(lm[L.foreheadTop], lm[L.chin]) || 0.001;
    var faceW = poseCompensatedDist(rawFaceW, headPose);
    var faceH = poseCompensatedDist(rawFaceH, headPose);

    // Eyes — prefer 14-point robust EAR, fallback to 6-point
    var earR14 = computeRobustEAR14(lm,
      L.rightEyeUpper, L.rightEyeLower, L.rightEye[0], L.rightEye[3]);
    var earL14 = computeRobustEAR14(lm,
      L.leftEyeUpper, L.leftEyeLower, L.leftEye[0], L.leftEye[3]);
    var earR6 = computeRobustEAR(lm, L.rightEye);
    var earL6 = computeRobustEAR(lm, L.leftEye);
    // Blend: 70% 14-point (more robust) + 30% 6-point (more sensitive)
    var earR = earR14 !== null ? earR14 * 0.7 + earR6 * 0.3 : earR6;
    var earL = earL14 !== null ? earL14 * 0.7 + earL6 * 0.3 : earL6;
    var earAvg = (earR + earL) * 0.5;
    var earDiff = Math.abs(earR - earL);

    // Brow measurements – bilateral
    var rBrowInnerY = lm[L.rightBrow[0]].y;
    var rBrowOuterY = lm[L.rightBrow[4]].y;
    var lBrowInnerY = lm[L.leftBrow[0]].y;
    var lBrowOuterY = lm[L.leftBrow[4]].y;
    var rEyeMidY = (lm[L.rightEye[1]].y + lm[L.rightEye[2]].y) * 0.5;
    var lEyeMidY = (lm[L.leftEye[1]].y + lm[L.leftEye[2]].y) * 0.5;

    // Brow-to-eye distances (normalized by faceH)
    var rBrowInnerDist = (rEyeMidY - rBrowInnerY) / faceH;
    var lBrowInnerDist = (lEyeMidY - lBrowInnerY) / faceH;
    var rBrowOuterDist = (rEyeMidY - rBrowOuterY) / faceH;
    var lBrowOuterDist = (lEyeMidY - lBrowOuterY) / faceH;

    // Mouth (with head-pose compensation for MAR)
    var mar = computeMAR(lm, headPose);
    var mouthW = d(lm[L.mouthLeft], lm[L.mouthRight]) / faceW;
    var lipTop = lm[L.mouthTopCenter], lipBot = lm[L.mouthBottomCenter];
    var lipH = d(lipTop, lipBot) / faceH;
    var innerTop = lm[L.innerLipTop];
    var lipThickness = d(lipTop, innerTop) / faceH;

    // Mouth corner positions relative to mouth center
    var mouthCenterY = (lipTop.y + lipBot.y) * 0.5;
    var rMouthCornerLift = (mouthCenterY - lm[L.mouthLeft].y) / faceH;
    var lMouthCornerLift = (mouthCenterY - lm[L.mouthRight].y) / faceH;

    // Nose measurements
    var noseWrinkle = d(lm[L.noseWing[0]], lm[L.noseWing[1]]) / faceW;

    // Cheek measurements (bilateral)
    var rCheekLift = (lm[L.rightMidCheek].y - lm[L.rightUpperCheek].y) / faceH;
    var lCheekLift = (lm[L.leftMidCheek].y - lm[L.leftUpperCheek].y) / faceH;

    // ── NEW: Corrugator (refined AU4) ──
    var rCorrugatorDist = d(lm[L.rightCorrugator[0]], lm[L.rightCorrugator[1]]) / faceW;
    var lCorrugatorDist = d(lm[L.leftCorrugator[0]], lm[L.leftCorrugator[1]]) / faceW;

    // ── NEW: Nasolabial fold depth ──
    var rNasolabialDist = d(lm[L.rightNasolabial[0]], lm[L.rightNasolabial[1]]) / faceH;
    var lNasolabialDist = d(lm[L.leftNasolabial[0]], lm[L.leftNasolabial[1]]) / faceH;

    // ── NEW: Mentalis (chin raise) ──
    var mentalisLift = (lm[L.chin].y - lm[L.mentalis[0]].y) / faceH;

    // ── NEW: Periorbital density (crow's feet - Duchenne marker) ──
    var rPeriorbDensity = h.periorbitalDensity(lm, L.rightPeriorbital, L.rightEye[3]);
    var lPeriorbDensity = h.periorbitalDensity(lm, L.leftPeriorbital, L.leftEye[3]);
    var periorbitalAvg  = (rPeriorbDensity + lPeriorbDensity) * 0.5;

    // ── NEW: Zygomatic (cheekbone lift for AU6) ──
    var rZygLift = (lm[L.rightMidCheek].y - lm[L.rightZygomatic].y) / faceH;
    var lZygLift = (lm[L.leftMidCheek].y - lm[L.leftZygomatic].y) / faceH;

    // ─── AU CALCULATIONS ───
    // AU1 – Inner Brow Raise (bilateral)
    var au1_right = cl((rBrowInnerDist - 0.08) * 6.0, 0, 1);
    var au1_left  = cl((lBrowInnerDist - 0.08) * 6.0, 0, 1);
    var au1 = (au1_right + au1_left) * 0.5;

    // AU2 – Outer Brow Raise (bilateral)
    var au2_right = cl((rBrowOuterDist - 0.06) * 7.0, 0, 1);
    var au2_left  = cl((lBrowOuterDist - 0.06) * 7.0, 0, 1);
    var au2 = (au2_right + au2_left) * 0.5;

    // AU4 – Brow Lowerer (corrugator enhanced)
    // Gain raised 8→10: brow depression has smaller physical range than
    // brow elevation (AU1), so higher gain compensates for anatomical
    // asymmetry (Ekman & Friesen 1978, intensity scale A-E).
    var browLower_r = cl((0.08 - rBrowInnerDist) * 10.0, 0, 1);
    var browLower_l = cl((0.08 - lBrowInnerDist) * 10.0, 0, 1);
    var corrugatorFactor = cl((0.12 - (rCorrugatorDist + lCorrugatorDist) * 0.5) * 12, 0, 1);
    var au4 = Math.min(1, ((browLower_r + browLower_l) * 0.5 + corrugatorFactor * 0.4));

    // AU5 – Upper Lid Raise
    var au5 = cl((earAvg - 0.27) * 5.0, 0, 1);

    // AU6 – Cheek Raise (enhanced with zygomatic + periorbital)
    var cheekBase = (rCheekLift + lCheekLift) * 0.5;
    var zygBase = (rZygLift + lZygLift) * 0.5;
    var au6 = cl(
      (cheekBase - 0.09) * (-6.0) * 0.5 +
      (zygBase - 0.05) * (-5.0) * 0.3 +
      periorbitalAvg * 0.2,
      0, 1
    );
    var au6_right = cl((rCheekLift - 0.09) * (-6.0), 0, 1);
    var au6_left  = cl((lCheekLift - 0.09) * (-6.0), 0, 1);

    // AU7 – Lid Tightener
    var au7 = cl((0.24 - earAvg) * 5.0, 0, 1);

    // AU9 – Nose Wrinkler (enhanced with nasolabial)
    // Gain raised -5→-7: nose wing contraction produces small landmark
    // displacement in MediaPipe; higher gain improves disgust/disdain
    // sensitivity (Ekman 2003, AU9 often subtle in natural expressions).
    var nasolabialFactor = (rNasolabialDist + lNasolabialDist) * 0.5;
    var au9 = cl(
      (noseWrinkle - 0.28) * (-7.0) * 0.65 +
      (0.06 - nasolabialFactor) * 10.0 * 0.35,
      0, 1
    );

    // AU10 – Upper Lip Raiser
    var au10 = cl((0.06 - lipThickness) * 12.0, 0, 1);

    // AU12 – Lip Corner Puller (bilateral)
    var au12_right = cl(rMouthCornerLift * 15.0, 0, 1);
    var au12_left  = cl(lMouthCornerLift * 15.0, 0, 1);
    var au12 = (au12_right + au12_left) * 0.5;

    // AU14 – Dimpler
    var au14 = cl((0.38 - mouthW) * 5.0, 0, 1);

    // AU15 – Lip Corner Depressor (bilateral)
    // Gain raised 15→20: depressor anguli oris produces smaller
    // displacement than zygomaticus major (AU12), so higher gain
    // compensates for anatomical asymmetry in mouth corner range.
    var au15_right = cl(-rMouthCornerLift * 20.0, 0, 1);
    var au15_left  = cl(-lMouthCornerLift * 20.0, 0, 1);
    var au15 = (au15_right + au15_left) * 0.5;

    // AU17 – Chin Raiser (enhanced with mentalis)
    var au17 = cl(
      (mentalisLift - 0.03) * 10.0 * 0.6 +
      (0.035 - lipThickness) * 15.0 * 0.4,
      0, 1
    );

    // AU20 – Lip Stretcher
    var au20 = cl((mouthW - 0.42) * 6.0, 0, 1);

    // AU23 – Lip Tightener
    var au23 = cl((0.03 - lipH) * 20.0, 0, 1);

    // AU24 – Lip Presser
    var au24 = cl((0.025 - lipThickness) * 25.0, 0, 1);

    // AU25 – Lips Part
    var au25 = cl(lipH * 12.0, 0, 1);

    // AU26 – Jaw Drop
    var au26 = cl((mar - 0.25) * 3.5, 0, 1);

    // AU43 – Eyes Closed
    var au43 = cl((0.18 - earAvg) * 8.0, 0, 1);

    // AU45 – Blink (complete closure)
    var au45 = earAvg < 0.16 ? 1 : 0;

    // AU46 – Wink
    var au46 = (earDiff > 0.06 && (earR < 0.18 || earL < 0.18)) ? 1 : 0;

    // ── Bilateral Asymmetry ──
    var browAsymmetry  = Math.abs(au1_right - au1_left) + Math.abs(au2_right - au2_left);
    var eyeAsymmetry   = Math.abs(earR - earL) / (earAvg + 0.001);
    var mouthAsymmetry = Math.abs(au12_right - au12_left) + Math.abs(au15_right - au15_left);
    var cheekAsymmetry = Math.abs(au6_right - au6_left);
    var overallAsymmetry = (browAsymmetry * 0.25 + eyeAsymmetry * 0.25 +
                            mouthAsymmetry * 0.3 + cheekAsymmetry * 0.2);

    // ── Muscle Conflict Detection ──
    // Antagonist pairs that indicate concurrent opposing movements
    var conflicts = [];
    // Smile (AU12) + Brow furrow (AU4) = masked negative emotion
    if (au12 > 0.3 && au4 > 0.3) conflicts.push({ pair: 'AU12+AU4', strength: Math.min(au12, au4) });
    // AU12 + AU23/AU24 = concurrent corner pull and lip compression
    if (au12 > 0.3 && (au23 > 0.3 || au24 > 0.3)) conflicts.push({ pair: 'AU12+AU23/24', strength: Math.min(au12, Math.max(au23, au24)) });
    // Brow raise (AU1/2) + Brow lower (AU4) = conflicting signals
    if ((au1 > 0.3 || au2 > 0.3) && au4 > 0.3) conflicts.push({ pair: 'AU1/2+AU4', strength: Math.min(Math.max(au1, au2), au4) });
    // Cheek raise (AU6) without smile (AU12) = possible forced expression
    if (au6 > 0.4 && au12 < 0.15) conflicts.push({ pair: 'AU6-AU12', strength: au6 });
    // Lip corner depressor (AU15) + Lip corner puller (AU12)
    if (au15 > 0.2 && au12 > 0.2) conflicts.push({ pair: 'AU12+AU15', strength: Math.min(au12, au15) });
    var muscleConflictScore = 0;
    for (var ci = 0; ci < conflicts.length; ci++) muscleConflictScore += conflicts[ci].strength;
    muscleConflictScore = cl(muscleConflictScore, 0, 1);

    // ── Duchenne Marker (enhanced with z-curvature) ──
    // Genuine smile = AU6 + AU12 with periorbital involvement (Ekman, 2003)
    // Z-curvature of periorbital region increases during genuine smiles
    // due to orbicularis oculi contraction creating crow's feet wrinkles.
    var zCurvR = h.zCurvature(lm, L.rightPeriorbital);
    var zCurvL = h.zCurvature(lm, L.leftPeriorbital);
    var zCurvAvg = (zCurvR + zCurvL) * 0.5;
    var duchenneScore = (au12 > 0.2)
      ? cl(
          Math.min(au6, au12) * 1.3 +
          periorbitalAvg * 0.4 +
          Math.min(zCurvAvg * 20, 0.3),   // z-curvature bonus (capped)
          0, 1)
      : 0;

    // ── Calibration observation ──
    // All identity-sensitive ratios are tracked. Poor-quality and
    // high-activity frames are rejected; high-quality neutral frames
    // can update the locked baseline with a very slow clipped drift.
    var calibrationMeasurements = {
      browInnerDist: (rBrowInnerDist + lBrowInnerDist) * 0.5,
      browOuterDist: (rBrowOuterDist + lBrowOuterDist) * 0.5,
      earAvg: earAvg,
      mar: mar,
      mouthW: mouthW,
      mouthCornerLift: (rMouthCornerLift + lMouthCornerLift) * 0.5,
      lipHeight: lipH,
      lipThickness: lipThickness,
      cheekDist: (rCheekLift + lCheekLift) * 0.5,
      mentalisLift: mentalisLift,
      corrugatorDist: (rCorrugatorDist + lCorrugatorDist) * 0.5,
      nasolabialDist: (rNasolabialDist + lNasolabialDist) * 0.5,
      faceAspect: faceH / Math.max(faceW, 0.001),
    };
    var calibrationActivity = Math.max(
      au1, au2, au4, au5, au6, au7, au9, au10, au12, au15,
      au17, au20, au23, au24, au25, au26
    );
    if (calibrator) {
      if (typeof calibrator.observe === 'function') {
        calibrator.observe(calibrationMeasurements, { quality: quality, activity: calibrationActivity });
      } else if (!calibrator.isLocked()) {
        calibrator.accumulate(calibrationMeasurements);
      }
    }

    // ── Apply per-user baseline correction (when calibrated) ──
    // Shift AU activations relative to personal neutral baseline.
    // Only applies correction when deviation exceeds the calibration
    // MAD (Median Absolute Deviation) — prevents noise-level jitter
    // from producing false AU activations.
    if (calibrator && calibrator.isLocked()) {
      var bl = calibrator.getBaseline();
      if (bl) {
        var madData = bl._mad || {};
        // Adjust brow AUs using personal brow rest position
        var cal1 = _calibShift(cl, (rBrowInnerDist + lBrowInnerDist) * 0.5, 'browInnerDist', 8.0, bl, madData);
        if (cal1 !== null) au1 = cal1;
        var cal2 = _calibShift(cl, (rBrowOuterDist + lBrowOuterDist) * 0.5, 'browOuterDist', 9.0, bl, madData);
        if (cal2 !== null) au2 = cal2;
        // Adjust eye AUs using personal eye openness
        if (typeof bl.earAvg === 'number') {
          var earThresh = (madData.earAvg || 0) * 1.5;
          au5 = cl((earAvg - bl.earAvg - earThresh) * 8.0, 0, 1);
          au7 = cl((bl.earAvg - earAvg - earThresh) * 8.0, 0, 1);
          au43 = cl((bl.earAvg - earAvg - 0.04) * 10.0, 0, 1);
          // Calibrated blink: EAR < 60% of personal rest = complete closure
          // More robust than fixed 0.16 threshold (varies by individual)
          au45 = earAvg < (bl.earAvg * 0.6) ? 1 : 0;
        }
        // Adjust mouth AUs using personal mouth rest width
        if (typeof bl.mouthW === 'number') {
          var mwThresh = (madData.mouthW || 0) * 1.5;
          au20 = cl((mouthW - bl.mouthW - mwThresh) * 10.0, 0, 1);
          au14 = cl((bl.mouthW - mouthW - mwThresh) * 8.0, 0, 1);
        }
        // AU4 (Brow Lowerer) — corrugator narrowing relative to personal rest
        // Blend ratio 70/30 favoring uncalibrated: prevents calibration
        // from halving sensitivity when deviation is within noise floor.
        // AU4 is the primary AU for anger/fear/anxiety/pain — must remain
        // responsive even when cal4 returns 0 (Ekman & Friesen 1978).
        var cal4 = _calibShift(cl, (rCorrugatorDist + lCorrugatorDist) * 0.5, 'corrugatorDist', -12.0, bl, madData);
        if (cal4 !== null) au4 = Math.min(1, au4 * 0.7 + cal4 * 0.3);
        // AU6 (Cheek Raise) — cheek lift relative to personal rest
        var cal6 = _calibShift(cl, (rCheekLift + lCheekLift) * 0.5, 'cheekDist', -8.0, bl, madData);
        if (cal6 !== null) au6 = Math.min(1, au6 * 0.5 + cal6 * 0.5);
        // AU9 (Nose Wrinkler) — nasolabial fold depth relative to personal rest
        // Blend ratio 70/30: AU9 is core to disgust/disdain/distaste detection.
        var cal9 = _calibShift(cl, (rNasolabialDist + lNasolabialDist) * 0.5, 'nasolabialDist', -10.0, bl, madData);
        if (cal9 !== null) au9 = Math.min(1, au9 * 0.7 + cal9 * 0.3);
        // Mouth and jaw AUs use deviations from the person's neutral
        // geometry, reducing identity-shape leakage into motion values.
        var cal10 = _calibShift(cl, lipThickness, 'lipThickness', -18.0, bl, madData);
        if (cal10 !== null) au10 = au10 * 0.5 + cal10 * 0.5;
        var cal12 = _calibShift(cl, (rMouthCornerLift + lMouthCornerLift) * 0.5, 'mouthCornerLift', 18.0, bl, madData);
        if (cal12 !== null) au12 = au12 * 0.6 + cal12 * 0.4;
        var cal15 = _calibShift(cl, (rMouthCornerLift + lMouthCornerLift) * 0.5, 'mouthCornerLift', -22.0, bl, madData);
        if (cal15 !== null) au15 = au15 * 0.6 + cal15 * 0.4;
        var cal17 = _calibShift(cl, mentalisLift, 'mentalisLift', 12.0, bl, madData);
        if (cal17 !== null) au17 = au17 * 0.5 + cal17 * 0.5;
        var cal23 = _calibShift(cl, lipH, 'lipHeight', -24.0, bl, madData);
        if (cal23 !== null) au23 = au23 * 0.5 + cal23 * 0.5;
        var cal24 = _calibShift(cl, lipThickness, 'lipThickness', -28.0, bl, madData);
        if (cal24 !== null) au24 = au24 * 0.5 + cal24 * 0.5;
        var cal25 = _calibShift(cl, lipH, 'lipHeight', 15.0, bl, madData);
        if (cal25 !== null) au25 = au25 * 0.5 + cal25 * 0.5;
        var cal26 = _calibShift(cl, mar, 'mar', 6.0, bl, madData);
        if (cal26 !== null) au26 = au26 * 0.5 + cal26 * 0.5;
      }
    }

    return {
      au1: au1, au2: au2, au4: au4, au5: au5, au6: au6, au7: au7,
      au9: au9, au10: au10, au12: au12, au14: au14, au15: au15,
      au17: au17, au20: au20, au23: au23, au24: au24, au25: au25,
      au26: au26, au43: au43, au45: au45, au46: au46,
      // Bilateral per-AU
      au1_right: au1_right, au1_left: au1_left,
      au2_right: au2_right, au2_left: au2_left,
      au6_right: au6_right, au6_left: au6_left,
      au12_right: au12_right, au12_left: au12_left,
      au15_right: au15_right, au15_left: au15_left,
      // Raw metrics
      earLeft: earL, earRight: earR, earAvg: earAvg, earDiff: earDiff,
      mar: mar, mouthWidth: mouthW, lipThickness: lipThickness,
      faceW: faceW, faceH: faceH,
      // NEW: Duchenne & periorbital
      duchenneScore: duchenneScore,
      periorbitalAvg: periorbitalAvg,
      rPeriorbDensity: rPeriorbDensity,
      lPeriorbDensity: lPeriorbDensity,
      // NEW: Asymmetry
      browAsymmetry: browAsymmetry, eyeAsymmetry: eyeAsymmetry,
      mouthAsymmetry: mouthAsymmetry, cheekAsymmetry: cheekAsymmetry,
      overallAsymmetry: overallAsymmetry,
      // NEW: Muscle conflicts
      muscleConflicts: conflicts,
      muscleConflictScore: muscleConflictScore,
      // NEW: Corrugator & nasolabial raw
      corrugatorAvg: (rCorrugatorDist + lCorrugatorDist) * 0.5,
      nasolabialAvg: (rNasolabialDist + lNasolabialDist) * 0.5,
    };
  }

  /* ═══ Temporal Dynamics v2 (Savitzky-Golay smooth derivatives) ═══
   *  Uses ring buffer + SG filter for noise-robust velocity
   *  and acceleration. Replaces simple frame-diff.
   *  Based on Cohn & Schmidt (2004) + Savitzky & Golay (1964)
   */
  function createAURingBuffer() {
    var buffers = {};
    var auList = cfg().AU_LIST;
    for (var i = 0; i < auList.length; i++) buffers[auList[i]] = [];
    return buffers;
  }

  function computeAUDynamics(prevAUs, currAUs, ringBuffers) {
    if (!prevAUs) return null;
    var auList = cfg().AU_LIST;
    var velocity = {};
    var acceleration = {};
    var onsets = [];
    var offsets = [];
    var TC = cfg().TEMPORAL;
    var bufLen = TC.dynamicsHistoryLen;

    for (var i = 0; i < auList.length; i++) {
      var key = auList[i];
      var curr = currAUs[key] || 0;

      // Update ring buffer
      if (ringBuffers) {
        if (!ringBuffers[key]) ringBuffers[key] = [];
        ringBuffers[key].push(curr);
        if (ringBuffers[key].length > bufLen) ringBuffers[key].shift();

        // SG smooth derivatives (need >= 5 samples)
        velocity[key] = hlp().sgVelocity(ringBuffers[key]);
        acceleration[key] = hlp().sgAcceleration(ringBuffers[key]);
      } else {
        velocity[key] = curr - (prevAUs[key] || 0);
        acceleration[key] = 0;
      }

      var prev = prevAUs[key] || 0;
      // Detect onset (AU rising from low)
      if (velocity[key] > TC.onsetVelocityMin && prev < 0.15) {
        onsets.push(key);
      }
      // Detect offset (AU falling from high)
      if (velocity[key] < -TC.offsetVelocityMin && prev > 0.3) {
        offsets.push(key);
      }
    }
    return {
      velocity: velocity,
      acceleration: acceleration,
      onsets: onsets,
      offsets: offsets,
    };
  }

  /* ═══ Head Pose Estimation v2 (3D-enhanced) ═══ */
  function computeHeadPose(lm) {
    return hlp().computeHeadPoseV2(lm);
  }

  /* ═══ Smooth AUs (1€ Filter) ═══ */
  function createAUFilters() {
    var filters = {};
    var keys = cfg().AU_LIST;
    // beta raised 0.01→0.04: improves tracking of rapid AU changes
    // (anger/fear onsets are faster than smile onsets, Hess & Kleck 1990).
    // minCutoff=1.5 still ensures low jitter at rest.
    for (var i = 0; i < keys.length; i++) {
      filters[keys[i]] = hlp().createOneEuroFilter(1.5, 0.04, 1.0);
    }
    // Also create filters for raw metrics
    for (var j = 0; j < SMOOTH_RAW_KEYS.length; j++) {
      filters[SMOOTH_RAW_KEYS[j]] = hlp().createOneEuroFilter(1.5, 0.04, 1.0);
    }
    return filters;
  }

  function smoothAUs(prev, curr, filtersOrAlpha) {
    if (!prev) return curr;
    var result = {};
    var keys = cfg().AU_LIST;

    // Backward-compatible: accept a 1€-filter object (new pipeline-isolated API)
    // or a numeric alpha for simple EMA fallback (legacy / test convenience).
    var useFilters = typeof filtersOrAlpha === 'object' && filtersOrAlpha !== null;
    var alpha = (!useFilters && typeof filtersOrAlpha === 'number') ? filtersOrAlpha : 0.35;
    var t = useFilters ? performance.now() / 1000 : 0;

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (useFilters) {
        result[k] = filtersOrAlpha[k].filter(curr[k] || 0, t);
      } else {
        result[k] = hlp().ema(prev[k] || 0, curr[k] || 0, alpha);
      }
    }
    // Also smooth raw metrics
    for (var j = 0; j < SMOOTH_RAW_KEYS.length; j++) {
      var rk = SMOOTH_RAW_KEYS[j];
      if (useFilters) {
        result[rk] = filtersOrAlpha[rk].filter(curr[rk] || 0, t);
      } else {
        result[rk] = hlp().ema(prev[rk] || 0, curr[rk] || 0, alpha);
      }
    }
    // Smooth bilateral AU values (reduces asymmetry jitter)
    for (var bi = 0; bi < SMOOTH_BILATERAL_KEYS.length; bi++) {
      var bk = SMOOTH_BILATERAL_KEYS[bi];
      if (useFilters) {
        if (!filtersOrAlpha[bk]) filtersOrAlpha[bk] = hlp().createOneEuroFilter(1.5, 0.01, 1.0);
        result[bk] = filtersOrAlpha[bk].filter(curr[bk] || 0, t);
      } else {
        result[bk] = hlp().ema(prev[bk] || 0, curr[bk] || 0, alpha);
      }
    }
    // Copy non-filterable fields
    result.muscleConflicts = curr.muscleConflicts;
    return result;
  }

  global.FaceAUDetector = Object.freeze({
    computeAUs:          computeAUs,
    computeAUDynamics:   computeAUDynamics,
    createAURingBuffer:  createAURingBuffer,
    createAUFilters:     createAUFilters,
    createCalibrator:    createCalibrator,
    computeHeadPose:     computeHeadPose,
    smoothAUs:           smoothAUs,
  });
})(typeof window !== 'undefined' ? window : globalThis);
