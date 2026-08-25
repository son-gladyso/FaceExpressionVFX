/* ═══════════════════════════════════════════════════════════════
 *  face-detector.js  –  Pipeline Facade
 *  Wraps AU detection → Expression analysis → Psychology engine
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function createPipeline() {
    var exprState = global.FaceExpressionAnalyzer.createState();
    var psyState  = global.FacePsychologyEngine.createState();
    var prevSmoothedAUs = null;
    var auRingBuffers = global.FaceAUDetector.createAURingBuffer();
    var auFilters = global.FaceAUDetector.createAUFilters();
    var calibrator = global.FaceAUDetector.createCalibrator(60);
    var blinkAnalyzer = global.FaceHelpers.createBlinkAnalyzer();

    return {
      process: function (landmarks) {
        if (!global.FaceHelpers.isValidFaceLandmarks(landmarks)) return null;

        try {
        // 1. Head pose first (needed for AU pose compensation)
        var headPose = global.FaceAUDetector.computeHeadPose(landmarks);

        // 2. Compute AUs (with per-user calibration + head pose compensation)
        var rawAUs = global.FaceAUDetector.computeAUs(landmarks, calibrator, headPose);
        var smoothedAUs = global.FaceAUDetector.smoothAUs(prevSmoothedAUs, rawAUs, auFilters);
        prevSmoothedAUs = smoothedAUs;

        // 3. Expression analysis (with authenticity + transitions + SG dynamics)
        var analysis = global.FaceExpressionAnalyzer.analyze(
          smoothedAUs, exprState, headPose, auRingBuffers
        );

        // 4. Blink rate + PERCLOS analysis (Stern 1984, Dinges 1998)
        blinkAnalyzer.recordBlinkIfNew(analysis.blinkCount, Date.now());
        // Feed EAR for PERCLOS every frame
        blinkAnalyzer.recordEyeState(smoothedAUs.earAvg || 0);
        var blinkAnalysis = blinkAnalyzer.interpret();

        // 5. Psychology engine
        global.FacePsychologyEngine.update(psyState, smoothedAUs, analysis, blinkAnalysis);

        // 6. z-depth curvature for periorbital wrinkles
        var zCurvPeriorbR = global.FaceHelpers.zCurvature(landmarks,
          global.FaceConfig.LANDMARKS.rightPeriorbital);
        var zCurvPeriorbL = global.FaceHelpers.zCurvature(landmarks,
          global.FaceConfig.LANDMARKS.leftPeriorbital);

        return {
          aus:         smoothedAUs,
          expressions: analysis.expressions,
          topExpr:     analysis.topExpression,
          topConf:     analysis.topConfidence,
          blinkCount:  analysis.blinkCount,
          microLog:    analysis.microLog,
          psychology:  psyState.smoothed,
          analysisText:psyState.analysisText,
          headPose:    headPose,
          // v3
          authenticity:      analysis.authenticity,
          transitionInfo:    analysis.transitionInfo,
          transitionLog:     analysis.transitionLog,
          transitionMatrix:  analysis.transitionMatrix,
          dynamics:          analysis.dynamics,
          regulationStyle:   psyState.regulationStyle,
          inertiaScore:      psyState.inertiaScore,
          baselineLocked:    psyState.baselineLocked,
          // v3.1 scientific enhancements
          blinkRate:         blinkAnalyzer.getBlinkRate(),
          blinkAnalysis:     blinkAnalysis,
          perclos:           blinkAnalyzer.getPERCLOS(),
          zCurvature:        { periorbR: zCurvPeriorbR, periorbL: zCurvPeriorbL },
          calibrated:        calibrator.isLocked(),
        };

        } catch (err) {
          // Error boundary: log but don't crash the animation loop
          if (typeof console !== 'undefined') console.error('[FacePipeline]', err);
          return null;
        }
      },
    };
  }

  global.FaceDetector = Object.freeze({ createPipeline: createPipeline });
})(typeof window !== 'undefined' ? window : globalThis);
