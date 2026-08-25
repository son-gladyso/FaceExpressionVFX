/* ═══════════════════════════════════════════════════════════════
 *  face-config.js  –  FACS Action Unit & Micro-Expression Config
 *  v3 – Scientific Enhancement: 78 key landmarks, temporal
 *  dynamics, authenticity thresholds, transition analysis.
 *
 *  Scientific references:
 *    Ekman & Friesen (1978) – FACS coding manual
 *    Ekman (2003) – Duchenne vs non-Duchenne smile
 *    Hess & Kleck (1990) – Temporal dynamics of expressions
 *    Cohn & Schmidt (2004) – AU onset/offset analysis
 *    Ekman et al. (1981) – Facial asymmetry & posed emotion
 *    Porter & ten Brinke (2008) – Micro-expression leakage
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var FACE_CONFIG = Object.freeze({

    /* ── MediaPipe Face Mesh Landmark Indices ── */
    LANDMARKS: Object.freeze({
      // Eyes – 6-point EAR [outer, upperA, upperB, inner, lowerB, lowerA]
      rightEye:   Object.freeze([33, 160, 158, 133, 153, 144]),
      leftEye:    Object.freeze([362, 385, 387, 263, 373, 380]),
      // Redundant eye points (occlusion-robust)
      rightEyeUpper: Object.freeze([246, 161, 160, 159, 158, 157, 173]),
      rightEyeLower: Object.freeze([7, 163, 144, 145, 153, 154, 155]),
      leftEyeUpper:  Object.freeze([466, 388, 387, 386, 385, 384, 398]),
      leftEyeLower:  Object.freeze([249, 390, 373, 374, 380, 381, 382]),
      // Iris (refined 468-477)
      rightIris: Object.freeze([468, 469, 470, 471, 472]),
      leftIris:  Object.freeze([473, 474, 475, 476, 477]),
      // ── NEW: Periorbital / Crow's feet (Orbicularis Oculi) ──
      // Critical for Duchenne marker detection (Ekman, 2003)
      rightPeriorbital: Object.freeze([130, 247, 30, 29]),
      leftPeriorbital:  Object.freeze([359, 467, 260, 259]),
      // Eyebrows – inner→outer
      rightBrow: Object.freeze([107, 66, 105, 63, 70]),
      leftBrow:  Object.freeze([336, 296, 334, 293, 300]),
      // ── NEW: Corrugator Supercilii (refined AU4) ──
      rightCorrugator: Object.freeze([46, 53]),
      leftCorrugator:  Object.freeze([276, 283]),
      // Nose
      noseBridge: 168, noseMid: 6, noseTip: 1, noseBase: 2,
      noseWing:   Object.freeze([48, 278]),
      // ── NEW: Nasolabial Fold (key for disgust/contempt) ──
      rightNasolabial: Object.freeze([49, 220]),
      leftNasolabial:  Object.freeze([279, 440]),
      // Mouth outer
      mouthLeft: 61, mouthRight: 291,
      mouthTopCenter: 0, mouthBottomCenter: 17,
      mouthOuter: Object.freeze([61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181]),
      // Mouth inner
      innerLipTop: 13, innerLipBottom: 14,
      innerMouthLeft: 78, innerMouthRight: 308,
      mouthInner: Object.freeze([78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178]),
      // ── NEW: Orbicularis Oris (refined lip) ──
      orbicularisOris: Object.freeze([87, 317, 164]),
      // ── NEW: Mentalis (chin region, AU17) ──
      mentalis: Object.freeze([199, 175, 18]),
      // Face reference anchors
      foreheadTop: 10, chin: 152, leftFace: 234, rightFace: 454,
      // ── NEW: Forehead midpoints ──
      foreheadMid: Object.freeze([151, 9]),
      // Cheek
      rightUpperCheek: 50, leftUpperCheek: 280,
      rightMidCheek: 205, leftMidCheek: 425,
      // ── NEW: Zygomatic major (cheekbone, key for AU6/AU12) ──
      rightZygomatic: 123, leftZygomatic: 352,
      // ── NEW: Temporalis / Masseter (jaw clenching) ──
      rightTemporalis: 116, leftTemporalis: 345,
      // Contour
      contour: Object.freeze([10,338,297,332,284,251,389,356,454,
        323,361,288,397,365,379,378,400,377,152,148,176,149,
        150,136,172,58,132,93,234,127,162,21,54,103,67,109]),
      // ── Head Pose Reference Points ──
      headPose: Object.freeze({
        noseTip: 1, chin: 152,
        leftEyeOuter: 263, rightEyeOuter: 33,
        leftMouth: 291, rightMouth: 61,
      }),
    }),

    /* ── 78 Key Display Landmarks (expanded from 50) ── */
    KEY_LANDMARKS_78: Object.freeze([
      // Right brow (5)
      107, 66, 105, 63, 70,
      // Left brow (5)
      336, 296, 334, 293, 300,
      // Right eye (8)
      33, 160, 159, 158, 133, 144, 145, 153,
      // Left eye (8)
      362, 385, 386, 387, 263, 380, 374, 373,
      // Nose (4)
      168, 1, 2, 4,
      // Mouth outer (8)
      61, 40, 0, 269, 291, 405, 17, 181,
      // Mouth inner (4)
      78, 13, 308, 14,
      // Face anchors (4)
      10, 152, 234, 454,
      // Cheeks (4)
      50, 280, 205, 425,
      // ── NEW: Periorbital / Crow's feet (8) ──
      130, 247, 30, 29, 359, 467, 260, 259,
      // ── NEW: Nasolabial fold (4) ──
      49, 220, 279, 440,
      // ── NEW: Corrugator supercilii (4) ──
      46, 53, 276, 283,
      // ── NEW: Mentalis (3) ──
      199, 175, 18,
      // ── NEW: Zygomatic + Temporalis (4) ──
      123, 352, 116, 345,
      // ── NEW: Forehead + Orbicularis Oris (5) ──
      151, 9, 87, 317, 164,
    ]),

    /* ── FACS Action Unit Definitions ── */
    AU_NAMES: Object.freeze({
      au1:  'Inner Brow Raise',        au2:  'Outer Brow Raise',
      au4:  'Brow Lowerer',            au5:  'Upper Lid Raise',
      au6:  'Cheek Raise',             au7:  'Lid Tightener',
      au9:  'Nose Wrinkler',           au10: 'Upper Lip Raiser',
      au12: 'Lip Corner Puller',       au14: 'Dimpler',
      au15: 'Lip Corner Depressor',    au17: 'Chin Raiser',
      au20: 'Lip Stretcher',           au23: 'Lip Tightener',
      au24: 'Lip Presser',             au25: 'Lips Part',
      au26: 'Jaw Drop',               au43: 'Eyes Closed',
      au45: 'Blink',                   au46: 'Wink',
    }),

    AU_LIST: Object.freeze([
      'au1','au2','au4','au5','au6','au7','au9','au10',
      'au12','au14','au15','au17','au20','au23','au24','au25','au26',
      'au43','au45','au46',
    ]),

    /* ── Expression Definitions ── */
    EXPRESSION_LABELS: Object.freeze({
      genuine_smile:   'Genuine Smile (Duchenne)',
      social_smile:    'Social Smile',
      suppressed_smile:'Suppressed Smile',
      surprise:        'Surprise',
      fear:            'Fear',
      anger:           'Anger',
      disgust:         'Disgust',
      contempt:        'Contempt',
      sadness:         'Sadness',
      anxiety:         'Anxiety',
      tension:         'Tension',
      concentration:   'Concentration',
      confusion:       'Confusion',
      disdain:         'Disdain',
      embarrassment:   'Embarrassment',
      pain:            'Pain',
      fatigue:         'Fatigue',
      boredom:         'Boredom',
      interest:        'Interest / Curiosity',
      pleasure:        'Pleasure',
      suppression:     'Emotion Suppression',
      au12_au14_asymmetry_pattern: 'AU12/AU14 Asymmetry Pattern',
      masked_sadness:  'Masked Sadness',
      nervous_smile:   'Nervous Smile',
      irritation:      'Irritation',
      melancholy:      'Melancholy',
      unease:          'Unease',
      distaste:        'Distaste',
      neutral:         'Neutral',
    }),

    /* ── Psychology Dimension Labels (12 dimensions) ── */
    PSYCHOLOGY_LABELS: Object.freeze({
      valence:            'Valence',
      arousal:            'Arousal',
      cognitiveLoad:      'Cognitive Load',
      stress:             'Stress',
      confidence:         'Confidence',
      engagement:         'Engagement',
      comfort:            'Comfort',
      authenticity:       'Expression Consistency',
      tension:            'Tension',
      patternAnomaly:     'Pattern Anomaly',
      suppressionEffort:  'Suppression Effort',
      emotionalRegulation:'Emotional Regulation',
    }),

    PSYCHOLOGY_KEYS: Object.freeze([
      'valence','arousal','cognitiveLoad','stress','confidence',
      'engagement','comfort','authenticity','tension','patternAnomaly',
      'suppressionEffort','emotionalRegulation',
    ]),

    /* ── Observable movement summaries (v3.11) ── */
    OBSERVABLE_LABELS: Object.freeze({
      browRaise: 'Brow Raise',
      browLower: 'Brow Lower',
      eyeOpening: 'Eye Opening',
      eyeClosure: 'Eye Closure',
      cheekRaise: 'Cheek Raise',
      noseWrinkle: 'Nose Wrinkle',
      lipCornerPull: 'Lip Corner Pull',
      lipCornerDepress: 'Lip Corner Depress',
      mouthOpening: 'Mouth Opening',
      lipCompression: 'Lip Compression',
      bilateralAsymmetry: 'Bilateral Asymmetry',
      motionEnergy: 'Motion Energy',
    }),

    OBSERVABLE_KEYS: Object.freeze([
      'browRaise','browLower','eyeOpening','eyeClosure','cheekRaise','noseWrinkle',
      'lipCornerPull','lipCornerDepress','mouthOpening','lipCompression',
      'bilateralAsymmetry','motionEnergy',
    ]),

    /* ── Temporal Dynamics Config ──
     *  Based on Hess & Kleck (1990), Cohn & Schmidt (2004)
     */
    TEMPORAL: Object.freeze({
      // Genuine smile onset: 0.5–0.7s (Ekman, 2003)
      genuineSmileOnsetMin: 350,   // ms
      genuineSmileOnsetMax: 900,   // ms
      // Fake smile onset: <200ms (too fast) or >1200ms (too slow)
      fakeSmileOnsetFast:   200,   // ms
      fakeSmileOnsetSlow:   1200,  // ms
      // Genuine expression duration: 0.5–4.0s
      genuineDurationMin:   500,   // ms
      genuineDurationMax:   4000,  // ms
      // AU velocity thresholds
      onsetVelocityMin:     0.003, // AU units/frame for onset detection
      offsetVelocityMin:    0.003,
      // Dynamics history length
      dynamicsHistoryLen:   10,    // frames
    }),

    /* ── Authenticity Scoring Weights ──
     *  Multi-factor scoring based on Ekman + Porter & ten Brinke (2008)
     */
    AUTHENTICITY: Object.freeze({
      duchenneWeight:       0.25,  // orbicularis oculi involvement
      temporalWeight:       0.20,  // onset/offset naturalness
      symmetryWeight:       0.15,  // bilateral symmetry
      durationWeight:       0.10,  // duration appropriateness
      muscleConflictWeight: 0.15,  // antagonist muscle activation
      leakageWeight:        0.15,  // micro-expression leakage
      // Asymmetry thresholds (Ekman et al., 1981)
      asymmetryGenuineMax:  0.15,  // genuine expressions: <15% asymmetry
      asymmetryFakedMin:    0.20,  // posed expressions: >20% asymmetry
    }),

    /* ── Transition Analysis Config ── */
    TRANSITION: Object.freeze({
      // Transition speed thresholds (milliseconds, FPS-independent)
      abruptMaxMs:       100,   // ≤100ms = abrupt  (~3 frames @30fps)
      smoothMinMs:       267,   // ≥267ms = smooth  (~8 frames @30fps)
      // Transition log size
      maxTransitions:    100,
      // Emotional inertia window (count of recent transitions)
      inertiaWindow:     30,
    }),

    /* ── Timing & Smoothing ── */
    PSYCHOLOGY: Object.freeze({
      historyLength:        300,   // ~10 sec @ 30fps (increased for deeper analysis)
      microExpressionMaxMs: 500,
      microExpressionMinMs: 40,
      baselineFrames:       90,
      smoothingAlpha:       0.10,  // slightly slower for stability
      blinkCooldownMs:      300,
      maxMicroLog:          100,   // increased
    }),

    /* ── Region Colors (for 78-point mesh - CYBER THEME) ── */
    REGION_COLORS: Object.freeze({
      brow:        '#00f0ff', // cy-cyan
      eye:         '#00f0ff',
      nose:        '#58a6ff', // cy-blue
      mouth:       '#b054ff', // cy-purple
      contour:     '#b054ff',
      cheek:       '#58a6ff',
      anchor:      '#8c8c8c',
      periorbital: '#b054ff',
      nasolabial:  '#58a6ff',
      corrugator:  '#00f0ff',
      mentalis:    '#b054ff',
      zygomatic:   '#58a6ff',
      forehead:    '#00f0ff',
    }),
  });

  global.FaceConfig = FACE_CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
