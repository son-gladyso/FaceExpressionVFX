/* ═══════════════════════════════════════════════════════════════
 *  face-quality.js – Frame quality gating and AU uncertainty
 *
 *  The module deliberately reports observable capture conditions.
 *  It does not infer eyewear, identity, intent, or mental state.
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var AU_REGION = Object.freeze({
    au1: 'brow', au2: 'brow', au4: 'brow',
    au5: 'eyes', au6: 'eyes', au7: 'eyes', au43: 'eyes', au45: 'eyes', au46: 'eyes',
    au9: 'nose', au10: 'mouth', au12: 'mouth', au14: 'mouth', au15: 'mouth',
    au17: 'jaw', au20: 'mouth', au23: 'mouth', au24: 'mouth', au25: 'mouth', au26: 'jaw',
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mean(values) {
    if (!values || values.length === 0) return 0;
    var total = 0;
    for (var i = 0; i < values.length; i++) total += values[i];
    return total / values.length;
  }

  function landmarkPointConfidence(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return 0;
    var visible = typeof point.visibility === 'number' ? clamp(point.visibility, 0, 1) : 1;
    var present = typeof point.presence === 'number' ? clamp(point.presence, 0, 1) : 1;
    return Math.min(visible, present);
  }

  function regionConfidence(landmarks, indices) {
    var values = [];
    for (var i = 0; i < indices.length; i++) {
      if (landmarks[indices[i]]) values.push(landmarkPointConfidence(landmarks[indices[i]]));
    }
    return values.length ? mean(values) : 0;
  }

  function computeLandmarkQuality(landmarks, headPose) {
    if (!Array.isArray(landmarks) || landmarks.length < 468) {
      return {
        score: 0, validRatio: 0, boundary: 0, scale: 0, pose: 0,
        regions: { brow: 0, eyes: 0, nose: 0, mouth: 0, jaw: 0 },
      };
    }

    var valid = 0;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < landmarks.length; i++) {
      var point = landmarks[i];
      if (landmarkPointConfidence(point) <= 0) continue;
      valid++;
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }

    var validRatio = valid / landmarks.length;
    var width = maxX - minX;
    var height = maxY - minY;
    var inside = clamp(Math.min(minX + 0.05, minY + 0.05, 1.05 - maxX, 1.05 - maxY) / 0.08, 0, 1);
    var scaleScore = clamp(Math.min(width / 0.20, height / 0.24, 0.95 / Math.max(width, 0.001), 0.95 / Math.max(height, 0.001)), 0, 1);

    var yaw = Math.abs(headPose && headPose.yaw || 0);
    var pitch = Math.abs(headPose && headPose.pitch || 0);
    var roll = Math.abs(headPose && headPose.roll || 0);
    var poseScore = clamp(1 - Math.max(yaw / 55, pitch / 45, roll / 50), 0, 1);

    var brow = regionConfidence(landmarks, [46, 53, 52, 65, 55, 70, 63, 105, 66, 107, 276, 283, 282, 295, 285, 300, 293, 334, 296, 336]);
    var eyes = regionConfidence(landmarks, [33, 133, 159, 145, 362, 263, 386, 374]);
    var nose = regionConfidence(landmarks, [1, 2, 98, 327, 168]);
    var mouth = regionConfidence(landmarks, [0, 13, 14, 17, 61, 291, 78, 308]);
    var jaw = regionConfidence(landmarks, [10, 152, 172, 397, 234, 454]);
    var posePenalty = 0.55 + poseScore * 0.45;
    var regions = {
      brow: brow * posePenalty,
      eyes: eyes * posePenalty,
      nose: nose * posePenalty,
      mouth: mouth * posePenalty,
      jaw: jaw * posePenalty,
    };
    var score = clamp(validRatio * 0.45 + inside * 0.20 + scaleScore * 0.15 + poseScore * 0.20, 0, 1);
    return {
      score: score,
      validRatio: validRatio,
      boundary: inside,
      scale: scaleScore,
      pose: poseScore,
      bbox: { x: minX, y: minY, width: width, height: height },
      regions: regions,
    };
  }

  function luminanceAt(data, offset) {
    return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
  }

  function patchQuality(gray, width, height, bounds) {
    var x0 = clamp(Math.floor(bounds.x0 * width), 0, width - 1);
    var y0 = clamp(Math.floor(bounds.y0 * height), 0, height - 1);
    var x1 = clamp(Math.ceil(bounds.x1 * width), x0 + 1, width);
    var y1 = clamp(Math.ceil(bounds.y1 * height), y0 + 1, height);
    var values = [];
    var clipped = 0;
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        var value = gray[y * width + x];
        values.push(value);
        if (value < 10 || value > 245) clipped++;
      }
    }
    if (values.length < 4) return 0.5;
    var avg = mean(values);
    var variance = 0;
    for (var i = 0; i < values.length; i++) variance += Math.pow(values[i] - avg, 2);
    variance /= values.length;
    var contrast = clamp(Math.sqrt(variance) / 35, 0, 1);
    var clipping = 1 - clamp((clipped / values.length) / 0.30, 0, 1);
    return contrast * 0.55 + clipping * 0.45;
  }

  function eyeBounds(landmarks, indices) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < indices.length; i++) {
      var p = landmarks[indices[i]];
      if (!p) continue;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    var padX = Math.max((maxX - minX) * 0.35, 0.01);
    var padY = Math.max((maxY - minY) * 1.2, 0.01);
    return { x0: minX - padX, y0: minY - padY, x1: maxX + padX, y1: maxY + padY };
  }

  function computePixelQuality(imageData, landmarks) {
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) return null;
    var data = imageData.data;
    var width = imageData.width;
    var height = imageData.height;
    var gray = new Float32Array(width * height);
    var total = 0, totalSq = 0, dark = 0, bright = 0;
    for (var i = 0; i < gray.length; i++) {
      var lum = luminanceAt(data, i * 4);
      gray[i] = lum;
      total += lum; totalSq += lum * lum;
      if (lum < 18) dark++;
      if (lum > 237) bright++;
    }
    var avg = total / gray.length;
    var std = Math.sqrt(Math.max(0, totalSq / gray.length - avg * avg));
    var exposure = clamp(1 - Math.abs(avg - 128) / 115, 0, 1);
    var contrast = clamp(std / 42, 0, 1);
    var clipping = 1 - clamp(((dark + bright) / gray.length) / 0.35, 0, 1);
    var lighting = exposure * 0.45 + contrast * 0.25 + clipping * 0.30;

    var lapTotal = 0, lapTotalSq = 0, lapCount = 0;
    for (var y = 1; y < height - 1; y++) {
      for (var x = 1; x < width - 1; x++) {
        var center = gray[y * width + x];
        var lap = gray[(y - 1) * width + x] + gray[(y + 1) * width + x] +
          gray[y * width + x - 1] + gray[y * width + x + 1] - 4 * center;
        lapTotal += lap; lapTotalSq += lap * lap; lapCount++;
      }
    }
    var lapMean = lapCount ? lapTotal / lapCount : 0;
    var lapVariance = lapCount ? Math.max(0, lapTotalSq / lapCount - lapMean * lapMean) : 0;
    var sharpness = clamp((Math.log1p(lapVariance) - 2.3) / 4.2, 0, 1);

    var eyeRegion = 0.5;
    if (Array.isArray(landmarks) && landmarks.length >= 468) {
      var right = patchQuality(gray, width, height, eyeBounds(landmarks, [33, 133, 159, 145, 160, 144]));
      var left = patchQuality(gray, width, height, eyeBounds(landmarks, [362, 263, 386, 374, 385, 380]));
      eyeRegion = Math.min(right, left) * 0.65 + mean([right, left]) * 0.35;
    }
    return {
      lighting: clamp(lighting, 0, 1),
      sharpness: sharpness,
      eyeRegion: clamp(eyeRegion, 0, 1),
      meanLuma: avg,
      contrast: std,
      clippedRatio: (dark + bright) / gray.length,
      laplacianVariance: lapVariance,
    };
  }

  function combineQuality(landmarkQuality, pixelQuality) {
    var score;
    if (pixelQuality) {
      score = landmarkQuality.score * 0.35 + landmarkQuality.pose * 0.15 +
        pixelQuality.lighting * 0.20 + pixelQuality.sharpness * 0.18 +
        pixelQuality.eyeRegion * 0.12;
    } else {
      score = landmarkQuality.score * 0.70 + landmarkQuality.pose * 0.30;
    }
    score = clamp(score, 0, 1);
    var reasons = [];
    if (landmarkQuality.validRatio < 0.90) reasons.push('landmarks_missing');
    if (landmarkQuality.boundary < 0.45) reasons.push('face_near_frame_edge');
    if (landmarkQuality.pose < 0.35) reasons.push('pose_too_oblique');
    if (!pixelQuality) reasons.push('pixel_quality_unavailable');
    if (pixelQuality && pixelQuality.lighting < 0.40) reasons.push('lighting_out_of_range');
    if (pixelQuality && pixelQuality.sharpness < 0.35) reasons.push('frame_blur');
    if (pixelQuality && pixelQuality.eyeRegion < 0.35) reasons.push('eye_region_occlusion_or_glare');

    var action = 'pass';
    if (score < 0.38 || landmarkQuality.validRatio < 0.70 || landmarkQuality.pose < 0.12 ||
        (pixelQuality && (pixelQuality.lighting < 0.15 || pixelQuality.sharpness < 0.10))) {
      action = 'pause';
    } else if (score < 0.68 || reasons.length > (pixelQuality ? 0 : 1)) {
      action = 'downweight';
    }

    var regions = {};
    var regionNames = Object.keys(landmarkQuality.regions);
    for (var i = 0; i < regionNames.length; i++) {
      var key = regionNames[i];
      var pixelFactor = key === 'eyes' && pixelQuality ? pixelQuality.eyeRegion : 1;
      regions[key] = clamp(landmarkQuality.regions[key] * pixelFactor, 0, 1);
    }
    return {
      score: score,
      confidenceScale: action === 'pause' ? 0 : clamp(0.35 + score * 0.65, 0, 1),
      action: action,
      reasons: reasons,
      components: {
        landmarks: landmarkQuality.score,
        pose: landmarkQuality.pose,
        lighting: pixelQuality ? pixelQuality.lighting : null,
        sharpness: pixelQuality ? pixelQuality.sharpness : null,
        eyeRegion: pixelQuality ? pixelQuality.eyeRegion : null,
      },
      regions: regions,
      raw: { landmark: landmarkQuality, pixel: pixelQuality },
    };
  }

  function createAnalyzer(options) {
    options = options || {};
    var sampleEvery = Math.max(1, options.sampleEvery || 5);
    var sampleWidth = Math.max(32, options.sampleWidth || 96);
    var sampleHeight = Math.max(24, options.sampleHeight || 72);
    var frame = 0;
    var canvas = null;
    var context = null;
    var lastPixelQuality = null;

    function sampleSource(source, landmarks) {
      if (!source || typeof document === 'undefined') return null;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = sampleWidth; canvas.height = sampleHeight;
        context = canvas.getContext('2d', { willReadFrequently: true });
      }
      if (!context) return null;
      try {
        context.drawImage(source, 0, 0, sampleWidth, sampleHeight);
        return computePixelQuality(context.getImageData(0, 0, sampleWidth, sampleHeight), landmarks);
      } catch {
        return null;
      }
    }

    return {
      analyze: function (source, landmarks, headPose) {
        frame++;
        if (frame === 1 || frame % sampleEvery === 0) {
          lastPixelQuality = sampleSource(source, landmarks);
        }
        return combineQuality(computeLandmarkQuality(landmarks, headPose), lastPixelQuality);
      },
      analyzeData: function (imageData, landmarks, headPose) {
        return combineQuality(computeLandmarkQuality(landmarks, headPose), computePixelQuality(imageData, landmarks));
      },
    };
  }

  function estimateAUIntervals(aus, quality, calibrationStatus) {
    var estimates = {};
    var globalScore = quality ? quality.score : 0.65;
    var regions = quality && quality.regions || {};
    var calibrated = calibrationStatus && calibrationStatus.locked;
    var calibrationConfidence = calibrated ? clamp(calibrationStatus.confidence || 0.85, 0.5, 1) : 0.60;
    var keys = Object.keys(AU_REGION);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = clamp(Number(aus[key]) || 0, 0, 1);
      var region = AU_REGION[key];
      var regionScore = typeof regions[region] === 'number' ? regions[region] : globalScore;
      var confidence = clamp(globalScore * 0.45 + regionScore * 0.35 + calibrationConfidence * 0.20, 0, 1);
      var bilateralPenalty = 0;
      if (key === 'au1' || key === 'au2' || key === 'au6' || key === 'au12' || key === 'au15') {
        var right = aus[key + '_right'];
        var left = aus[key + '_left'];
        if (typeof right === 'number' && typeof left === 'number') bilateralPenalty = Math.min(0.18, Math.abs(right - left) * 0.25);
      }
      confidence = clamp(confidence - bilateralPenalty, 0, 1);
      var halfWidth = 0.035 + (1 - confidence) * 0.32 + ((key === 'au45' || key === 'au46') ? 0.03 : 0);
      estimates[key] = {
        value: value,
        lower: clamp(value - halfWidth, 0, 1),
        upper: clamp(value + halfWidth, 0, 1),
        confidence: confidence,
        region: region,
      };
    }
    return estimates;
  }

  global.FaceQuality = Object.freeze({
    computeLandmarkQuality: computeLandmarkQuality,
    computePixelQuality: computePixelQuality,
    combineQuality: combineQuality,
    createAnalyzer: createAnalyzer,
    estimateAUIntervals: estimateAUIntervals,
  });
})(typeof window !== 'undefined' ? window : globalThis);
