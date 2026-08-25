/* Observable-only FaceVFX v3.11 pipeline. */
(function (global) {
  'use strict';

  function defaultQuality(landmarks, headPose) {
    var landmark = global.FaceQuality.computeLandmarkQuality(landmarks, headPose);
    return global.FaceQuality.combineQuality(landmark, null);
  }

  function temporalCandidates(estimates) {
    var candidates = [];
    var keys = global.FaceConfig.AU_LIST;
    for (var i = 0; i < keys.length; i++) {
      var estimate = estimates[keys[i]];
      if (!estimate || estimate.value < 0.10) continue;
      candidates.push({
        name: keys[i],
        confidence: estimate.value * estimate.confidence,
      });
    }
    candidates.sort(function (a, b) { return b.confidence - a.confidence; });
    return candidates;
  }

  function buildSummary(aus, estimates, quality, temporal, calibration, inferenceSource) {
    var lines = [];
    lines.push('[Capture] quality ' + Math.round(quality.score * 100) + '% · ' + quality.action);
    if (quality.reasons.length) lines.push('[Quality flags] ' + quality.reasons.join(', '));
    lines.push('[Calibration] ' + (calibration.locked ? 'locked' : 'collecting') +
      ' · accepted ' + calibration.accepted + ' · rejected ' + calibration.rejected);
    lines.push('[Inference] ' + inferenceSource + ' · observable geometry only');
    if (temporal) {
      lines.push('[Temporal AU state] ' + temporal.label.toUpperCase() +
        ' · posterior ' + Math.round(temporal.confidence * 100) +
        '% · uncertainty ' + Math.round(temporal.entropy * 100) + '%');
    }
    var active = [];
    var keys = global.FaceConfig.AU_LIST;
    for (var i = 0; i < keys.length; i++) {
      var estimate = estimates[keys[i]];
      if (estimate && estimate.value >= 0.12) active.push({ key: keys[i], estimate: estimate });
    }
    active.sort(function (a, b) { return b.estimate.value - a.estimate.value; });
    for (var j = 0; j < Math.min(6, active.length); j++) {
      var item = active[j];
      lines.push('[' + item.key.toUpperCase() + '] ' + item.estimate.value.toFixed(2) +
        ' [' + item.estimate.lower.toFixed(2) + ', ' + item.estimate.upper.toFixed(2) +
        '] · confidence ' + Math.round(item.estimate.confidence * 100) + '%');
    }
    if (!active.length) lines.push('[AU activity] none above 0.12');
    return lines.join('\n');
  }

  function createPipeline(options) {
    options = options || {};
    var previousAUs = null;
    var auRingBuffers = global.FaceAUDetector.createAURingBuffer();
    var auFilters = global.FaceAUDetector.createAUFilters();
    var calibrator = global.FaceAUDetector.createCalibrator(options.calibrationFrames || 60, options.calibration);
    var temporalState = global.FaceTemporal.createState(options.temporal);
    var blinkAnalyzer = global.FaceHelpers.createBlinkAnalyzer();
    var modelAdapter = global.FaceModelAdapter.create(options.modelProvider || null, options.model);
    var blinkCount = 0;
    var previousClosed = false;

    return {
      process: function (landmarks, frameContext) {
        if (!global.FaceHelpers.isValidFaceLandmarks(landmarks)) return null;
        frameContext = frameContext || {};
        try {
          var now = typeof frameContext.now === 'number' ? frameContext.now : Date.now();
          var headPose = frameContext.headPose || global.FaceAUDetector.computeHeadPose(landmarks);
          var quality = frameContext.quality || defaultQuality(landmarks, headPose);
          var calibration = calibrator.getStatus();

          if (quality.action === 'pause') {
            var pausedTemporal = global.FaceTemporal.update(temporalState, [], now, quality);
            return {
              paused: true,
              quality: quality,
              headPose: headPose,
              temporal: pausedTemporal,
              calibrated: calibration.locked,
              calibration: calibration,
              inferenceSource: 'paused',
              analysisText: buildSummary({}, {}, quality, pausedTemporal, calibration, 'paused'),
            };
          }

          var ruleAUs = global.FaceAUDetector.computeAUs(landmarks, calibrator, headPose, quality);
          var learned = modelAdapter.isEnabled()
            ? modelAdapter.predict({ landmarks: landmarks, headPose: headPose, quality: quality, ruleAUs: ruleAUs })
            : null;
          var fusion = modelAdapter.fuse(ruleAUs, learned, quality);
          var aus = global.FaceAUDetector.smoothAUs(previousAUs, fusion.aus, auFilters);
          var dynamics = previousAUs
            ? global.FaceAUDetector.computeAUDynamics(previousAUs, aus, auRingBuffers)
            : null;
          previousAUs = aus;

          calibration = calibrator.getStatus();
          var estimates = global.FaceQuality.estimateAUIntervals(aus, quality, calibration);
          var temporal = global.FaceTemporal.update(temporalState, temporalCandidates(estimates), now, quality);
          var observables = global.FaceObservables.compute(aus, dynamics, quality, estimates, temporal);

          var closed = aus.au45 === 1;
          if (closed && !previousClosed) blinkCount++;
          previousClosed = closed;
          blinkAnalyzer.recordBlinkIfNew(blinkCount, now);
          blinkAnalyzer.recordEyeState(aus.earAvg || 0);
          var blinkAnalysis = blinkAnalyzer.interpret();

          return {
            schemaVersion: '3.11.0',
            paused: false,
            aus: aus,
            auEstimates: estimates,
            observables: observables,
            temporal: temporal,
            quality: quality,
            headPose: headPose,
            dynamics: dynamics,
            blinkCount: blinkCount,
            blinkRate: blinkAnalyzer.getBlinkRate(),
            blinkAnalysis: blinkAnalysis,
            perclos: blinkAnalyzer.getPERCLOS(),
            calibrated: calibration.locked,
            calibration: calibration,
            inferenceSource: fusion.source,
            modelWeight: fusion.modelWeight,
            modelMetadata: modelAdapter.isEnabled() ? modelAdapter.metadata() : null,
            analysisText: buildSummary(aus, estimates, quality, temporal, calibration, fusion.source),
          };
        } catch (error) {
          if (typeof console !== 'undefined') console.error('[FacePipeline]', error);
          return null;
        }
      },
    };
  }

  global.FaceDetector = Object.freeze({ createPipeline: createPipeline });
})(typeof window !== 'undefined' ? window : globalThis);
