/* ═══════════════════════════════════════════════════════════════
 *  script.js  –  Main Application v3.11
 *  78-point mesh rendering, quality-gated observable pipeline,
 *  i18n, data export, history recording,
 *  PWA install prompt, mobile camera adaptation
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CFG     = window.FaceConfig;
  var POL     = window.FacePolicies;
  var H       = window.FaceHelpers;
  var I18n    = window.FaceI18n;
  var EXP     = window.FaceExport;
  var HIST    = window.FaceHistory;

  function t(k) { return I18n ? I18n.t(k) : k; }
  function ql(k) { return I18n ? I18n.observableLabel(k) : k; }

  /* ── DOM refs ── */
  var video       = document.getElementById('webcam');
  var canvas      = document.getElementById('overlay');
  var ctx         = canvas.getContext('2d');
  var statusLine  = document.getElementById('statusLine');
  var fpsDisplay  = document.getElementById('fpsDisplay');
  var qualityDisplay = document.getElementById('qualityDisplay');
  var exprListEl  = document.getElementById('exprList');
  var auBarsEl    = document.getElementById('auBars');
  var psyDimsEl   = document.getElementById('psyDims');
  var analysisEl  = document.getElementById('analysisText');
  var microLogEl  = document.getElementById('microLog');
  var blinkEl     = document.getElementById('blinkCount');
  // NEW v3
  var authOverallEl = document.getElementById('authOverall');
  var transLogEl    = document.getElementById('transitionLog');
  var hpYawEl       = document.getElementById('hpYaw');
  var hpPitchEl     = document.getElementById('hpPitch');
  var hpRollEl      = document.getElementById('hpRoll');

  /* ── Auth factor bar elements ── */
  var authBarEls = {
    duchenne:       document.getElementById('authDuchenne'),
    temporal:       document.getElementById('authTemporal'),
    symmetry:       document.getElementById('authSymmetry'),
    duration:       document.getElementById('authDuration'),
    muscleConflict: document.getElementById('authConflict'),
    leakage:        document.getElementById('authLeakage'),
  };

  /* ── Toolbar & History DOM refs ── */
  var btnLang          = document.getElementById('btnLang');
  var btnExportJSON    = document.getElementById('btnExportJSON');
  var btnExportCSV     = document.getElementById('btnExportCSV');
  var btnRecordToggle  = document.getElementById('btnRecordToggle');
  var recordLabel      = document.getElementById('recordLabel');
  var btnHistory       = document.getElementById('btnHistory');
  var historyModal     = document.getElementById('historyModal');
  var btnCloseHistory  = document.getElementById('btnCloseHistory');
  var profileSelect    = document.getElementById('profileSelect');
  var btnNewProfile    = document.getElementById('btnNewProfile');
  var btnDeleteProfile = document.getElementById('btnDeleteProfile');
  var btnClearHistory  = document.getElementById('btnClearHistory');
  var btnExportHistory = document.getElementById('btnExportHistory');
  var trendSummary     = document.getElementById('trendSummary');
  var sessionList      = document.getElementById('sessionList');
  var historyModalTitle= document.getElementById('historyModalTitle');
  var profileLabel     = document.getElementById('profileLabel');

  /* ── State ── */
  var pipeline = null;
  var lastFpsTime = performance.now();
  var fpsFrames = 0;
  var _lastResult = null;  // cache for export
  var _history = null;     // FaceHistory instance
  var _currentProfileId = null;
  var _qualityMode = POL.resolveQualityMode(navigator);
  var _isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  var _deferredInstallPrompt = null;
  var _frameQuality = window.FaceQuality.createAnalyzer({ sampleEvery: 5 });

  /* ── PWA Install Prompt ── */
  var btnInstall = document.getElementById('btnInstall');
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    _deferredInstallPrompt = e;
    if (btnInstall) btnInstall.style.display = '';
  });
  if (btnInstall) {
    btnInstall.addEventListener('click', function () {
      if (!_deferredInstallPrompt) return;
      _deferredInstallPrompt.prompt();
      _deferredInstallPrompt.userChoice.then(function () {
        _deferredInstallPrompt = null;
        btnInstall.style.display = 'none';
      });
    });
  }
  window.addEventListener('appinstalled', function () {
    _deferredInstallPrompt = null;
    if (btnInstall) btnInstall.style.display = 'none';
  });

  /* ── Cached DOM refs for per-frame updates (populated by build*Rows) ── */
  var auFillEls = {};   // key → element
  var auValEls  = {};   // key → element
  var psyFillEls = {};  // observable key → element
  var psyValEls  = {};  // observable key → element

  /* ── Change-detection caches (avoid innerHTML reparse when unchanged) ── */
  var _lastExprHTML  = '';
  var _lastTransHTML = '';
  var _lastMicroHTML = '';

  /* ═══ Build Static AU Rows ═══ */
  function buildAURows() {
    var auList = CFG.AU_LIST;
    var names  = CFG.AU_NAMES;
    auBarsEl.innerHTML = '';
    for (var i = 0; i < auList.length; i++) {
      var key = auList[i];
      var row = document.createElement('div');
      row.className = 'au-row';
      row.innerHTML =
        '<span class="au-label">' + key.toUpperCase() + '</span>' +
        '<span class="au-name">' + (names[key] || '') + '</span>' +
        '<div class="au-track"><div class="au-fill" id="auFill_' + key + '"></div></div>' +
        '<span class="au-val" id="auVal_' + key + '">0</span>';
      auBarsEl.appendChild(row);
      auFillEls[key] = row.querySelector('.au-fill');
      auValEls[key]  = row.querySelector('.au-val');
    }
  }

  /* ═══ Build Static Observable Rows ═══ */
  function buildPsyRows() {
    var keys = CFG.OBSERVABLE_KEYS;
    psyDimsEl.innerHTML = '';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var row = document.createElement('div');
      row.className = 'psy-row';
      row.innerHTML =
        '<span class="psy-label" data-psy="' + k + '">' + ql(k) + '</span>' +
        '<div class="psy-track"><div class="psy-fill" data-dim="' + k + '" id="psyFill_' + k + '"></div></div>' +
        '<span class="psy-val" id="psyVal_' + k + '">0</span>';
      psyDimsEl.appendChild(row);
      psyFillEls[k] = row.querySelector('.psy-fill');
      psyValEls[k]  = row.querySelector('.psy-val');
    }
  }

  /* ═══ Landmark Region Mapping for 78-point mesh ═══ */
  // Pre-compute idx → color lookup (avoids per-frame indexOf on 78-element array)
  var _pointColorMap = null;
  function buildPointColorMap() {
    var KL = CFG.KEY_LANDMARKS_78;
    var RC = CFG.REGION_COLORS;
    var map = {};
    for (var i = 0; i < KL.length; i++) {
      var color;
      if      (i < 10) color = RC.brow;
      else if (i < 26) color = RC.eye;
      else if (i < 30) color = RC.nose;
      else if (i < 42) color = RC.mouth;      // outer + inner
      else if (i < 46) color = RC.anchor;
      else if (i < 50) color = RC.cheek;
      else if (i < 58) color = RC.periorbital;
      else if (i < 62) color = RC.nasolabial;
      else if (i < 66) color = RC.corrugator;
      else if (i < 69) color = RC.mentalis;
      else if (i < 73) color = RC.zygomatic;
      else              color = RC.forehead;
      map[KL[i]] = color;
    }
    return map;
  }
  function getPointColor(idx) {
    if (!_pointColorMap) _pointColorMap = buildPointColorMap();
    return _pointColorMap[idx] || '#ffffff';
  }

  /* ═══ Draw 78-Point Mesh ═══ */
  function drawMesh(landmarks) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var KL = CFG.KEY_LANDMARKS_78;
    var w = canvas.width, h = canvas.height;

    for (var i = 0; i < KL.length; i++) {
      var idx = KL[i];
      var pt = landmarks[idx];
      if (!pt) continue;
      var x = pt.x * w, y = pt.y * h;
      var color = getPointColor(idx);

      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
    }

    // Draw connections for key regions
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    // Right brow
    drawConnections(landmarks, w, h, [107, 66, 105, 63, 70], CFG.REGION_COLORS.brow);
    // Left brow
    drawConnections(landmarks, w, h, [336, 296, 334, 293, 300], CFG.REGION_COLORS.brow);
    // Right eye
    drawLoop(landmarks, w, h, [33, 160, 159, 158, 133, 153, 145, 144], CFG.REGION_COLORS.eye);
    // Left eye
    drawLoop(landmarks, w, h, [362, 385, 386, 387, 263, 373, 374, 380], CFG.REGION_COLORS.eye);
    // Mouth outer
    drawLoop(landmarks, w, h, [61, 40, 0, 269, 291, 405, 17, 181], CFG.REGION_COLORS.mouth);

    ctx.globalAlpha = 1;
  }

  function drawConnections(landmarks, w, h, indices, color) {
    if (indices.length < 2) return;
    var first = landmarks[indices[0]];
    if (!first) return;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(first.x * w, first.y * h);
    for (var i = 1; i < indices.length; i++) {
      var pt = landmarks[indices[i]];
      if (!pt) return;
      ctx.lineTo(pt.x * w, pt.y * h);
    }
    ctx.stroke();
  }

  function drawLoop(landmarks, w, h, indices, color) {
    if (indices.length < 3) return;
    var first = landmarks[indices[0]];
    if (!first) return;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(first.x * w, first.y * h);
    for (var i = 1; i < indices.length; i++) {
      var pt = landmarks[indices[i]];
      if (!pt) return;
      ctx.lineTo(pt.x * w, pt.y * h);
    }
    ctx.closePath();
    ctx.stroke();
  }

  /* ═══ Update Dashboard ═══ */
  function updateDashboard(result) {
    if (!result) return;
    _lastResult = result;  // cache for export

    if (qualityDisplay && result.quality) {
      qualityDisplay.textContent = 'Q ' + Math.round(result.quality.score * 100) + '% · ' + result.quality.action;
      qualityDisplay.className = 'fps quality-' + result.quality.action;
    }

    if (result.paused) {
      analysisEl.textContent = result.analysisText || '';
      statusLine.textContent = t('statusQualityPaused');
      return;
    }

    // ── Feed history if recording ──
    if (_history && _history.isRecording()) {
      _history.addSnapshot(result);
    }

    // ── Strongest observable AU activations ──
    var exprHTML = '';
    var rankedAUs = [];
    for (var rk = 0; rk < CFG.AU_LIST.length; rk++) {
      var re = result.auEstimates[CFG.AU_LIST[rk]];
      if (re) rankedAUs.push({ name: CFG.AU_LIST[rk], estimate: re });
    }
    rankedAUs.sort(function (a, b) { return b.estimate.value - a.estimate.value; });
    var shown = Math.min(rankedAUs.length, 8);
    for (var i = 0; i < shown; i++) {
      var e = rankedAUs[i];
      var estimate = e.estimate;
      var label = e.name.toUpperCase() + ' · ' + (CFG.AU_NAMES[e.name] || '');
      var pct = (estimate.value * 100).toFixed(0);
      var isTop = i === 0 ? ' top-expr' : '';
      exprHTML +=
        '<div class="expr-item' + isTop + '">' +
          '<span class="expr-name">' + label + '</span>' +
          '<div class="expr-bar"><div class="expr-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="expr-pct">' + estimate.lower.toFixed(2) + '–' + estimate.upper.toFixed(2) +
          ' / ' + Math.round(estimate.confidence * 100) + '%</span>' +
        '</div>';
    }
    if (exprHTML !== _lastExprHTML) {
      exprListEl.innerHTML = exprHTML;
      _lastExprHTML = exprHTML;
    }

    // ── AU bars (use cached refs) ──
    var auList = CFG.AU_LIST;
    for (var ai = 0; ai < auList.length; ai++) {
      var ak = auList[ai];
      var av = result.aus[ak] || 0;
      var ae = result.auEstimates[ak];
      var fillEl = auFillEls[ak];
      var valEl  = auValEls[ak];
      if (fillEl) fillEl.style.width = (av * 100).toFixed(0) + '%';
      if (valEl && ae) {
        valEl.textContent = av.toFixed(2) + ' [' + ae.lower.toFixed(2) + '–' + ae.upper.toFixed(2) + ']';
        valEl.title = 'confidence ' + Math.round(ae.confidence * 100) + '%';
      }
    }

    // ── Observable movement dimensions ──
    var psyKeys = CFG.OBSERVABLE_KEYS;
    for (var pi = 0; pi < psyKeys.length; pi++) {
      var pk = psyKeys[pi];
      var oi = result.observables.intervals[pk];
      var pv = oi ? oi.value : 0;
      var pfill = psyFillEls[pk];
      var pval  = psyValEls[pk];
      if (pfill) pfill.style.width = (pv * 100).toFixed(0) + '%';
      if (pval && oi) pval.textContent = oi.lower.toFixed(2) + '–' + oi.upper.toFixed(2);
    }

    // ── Quality and Bayesian temporal state ──
    if (result.temporal) {
      authOverallEl.textContent = result.temporal.label.toUpperCase() + ' · ' +
        Math.round(result.temporal.confidence * 100) + '%';
      authOverallEl.className = 'auth-badge suspect';
      var components = result.quality.components || {};
      var factorValues = {
        duchenne: components.landmarks || 0,
        temporal: 1 - result.temporal.entropy,
        symmetry: components.pose || 0,
        duration: Math.min(1, result.temporal.durationMs / 1000),
        muscleConflict: components.lighting == null ? 0.5 : components.lighting,
        leakage: components.sharpness == null ? 0.5 : components.sharpness,
      };
      var factorKeys = Object.keys(authBarEls);
      for (var fi = 0; fi < factorKeys.length; fi++) {
        var fk = factorKeys[fi];
        var fv = factorValues[fk] || 0;
        authBarEls[fk].style.width = Math.round(fv * 100) + '%';
        authBarEls[fk].className = 'bar-fill ' + (fv > 0.6 ? 'high' : fv > 0.3 ? 'mid' : 'low');
      }
    }

    // ── Head Pose ──
    if (result.headPose) {
      hpYawEl.textContent   = result.headPose.yaw.toFixed(1) + '°';
      hpPitchEl.textContent = result.headPose.pitch.toFixed(1) + '°';
      hpRollEl.textContent  = result.headPose.roll.toFixed(1) + '°';
    }

    var qualityHTML = '';
    var flags = result.quality.reasons.length ? result.quality.reasons : ['none'];
    for (var qi = 0; qi < flags.length; qi++) {
      qualityHTML += '<div class="trans-item"><span>' + flags[qi] + '</span></div>';
    }
    transLogEl.innerHTML = qualityHTML;

    // ── Analysis text ──
    analysisEl.textContent = result.analysisText || '';

    // ── Blink count ──
    blinkEl.textContent = t('blink') + ': ' + (result.blinkCount || 0);

    microLogEl.textContent = (result.calibrated ? t('calibrationLocked') : t('calibrationCollecting')) +
      ' · ' + result.inferenceSource +
      (result.modelMetadata ? ' · ' + result.modelMetadata.name + ' ' + result.modelMetadata.version : '');
  }

  /* ═══ FPS Counter ═══ */
  function updateFPS() {
    fpsFrames++;
    var now = performance.now();
    if (now - lastFpsTime >= 1000) {
      fpsDisplay.textContent = fpsFrames + ' FPS';
      fpsFrames = 0;
      lastFpsTime = now;
    }
  }

  /* ═══ MediaPipe Callback ═══ */
  function onResults(results) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      statusLine.textContent = t('statusNoFace');
      return;
    }

    var landmarks = results.multiFaceLandmarks[0];
    if (!H.isValidFaceLandmarks(landmarks)) return;

    // Draw mesh
    drawMesh(landmarks);

    // Quality gate is computed before AU inference so unusable frames never
    // update calibration or temporal state.
    if (!pipeline) pipeline = window.FaceDetector.createPipeline();
    var headPose = window.FaceAUDetector.computeHeadPose(landmarks);
    var quality = _frameQuality.analyze(results.image || video, landmarks, headPose);
    var result = pipeline.process(landmarks, {
      quality: quality,
      headPose: headPose,
      now: Date.now(),
    });
    if (result) {
      updateDashboard(result);
      if (!result.paused) statusLine.textContent = t('statusOnline');
    }

    updateFPS();
  }

  /* ═══ Visibility API ═══ */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      statusLine.textContent = t('statusPaused');
    }
  });

  /* ═══ i18n: Refresh all static UI text ═══ */
  function refreshUIText() {
    // Section titles
    var titles = document.querySelectorAll('.section-title');
    if (titles[0]) {
      titles[0].innerHTML =
        '<span class="dot"></span> ' + t('cameraTitle') +
        ' <span id="qualityDisplay" class="fps">' +
        (document.getElementById('qualityDisplay') ?
          document.getElementById('qualityDisplay').textContent : 'Q —') +
        '</span>' +
        ' <span id="fpsDisplay" class="fps">' +
        (document.getElementById('fpsDisplay') ?
          document.getElementById('fpsDisplay').textContent : '0 FPS') +
        '</span>';
      fpsDisplay = document.getElementById('fpsDisplay');
      qualityDisplay = document.getElementById('qualityDisplay');
    }
    // Panel titles
    var panelTitles = {
      '.expression-panel h3':   t('exprTitle'),
      '.authenticity-panel h3': t('authTitle'),
      '.au-panel h3':           t('auTitle'),
      '.psy-panel h3':          t('psyTitle'),
      '.transition-panel h3':   t('transTitle'),
      '.analysis-panel h3':     t('analysisTitle'),
    };
    for (var sel in panelTitles) {
      var elem = document.querySelector(sel);
      if (elem) {
        // Preserve auth badge or deco-line span
        var badge = elem.querySelector('.auth-badge, .deco-line, .blink-badge');
        elem.textContent = panelTitles[sel] + ' ';
        if (badge) elem.appendChild(badge);
        else {
          var deco = document.createElement('span');
          deco.className = 'deco-line';
          elem.appendChild(deco);
        }
      }
    }
    // Micro panel has blink badge
    var microH3 = document.querySelector('.micro-panel h3');
    if (microH3) {
      var blinkBadge = microH3.querySelector('.blink-badge');
      microH3.textContent = t('microTitle') + ' ';
      if (blinkBadge) microH3.appendChild(blinkBadge);
    }
    // Head pose title
    var hpH3 = document.querySelector('.head-pose-panel h3');
    if (hpH3) {
      hpH3.innerHTML = t('headPoseTitle') + ' <span class="deco-line"></span>';
    }
    // Page title
    document.title = t('pageTitle');
    // Authenticity factor labels
    var authLabels = ['authDuchenne','authTemporal','authSymmetry','authDuration','authConflict','authLeakage'];
    var authRows = document.querySelectorAll('.auth-row');
    for (var ai = 0; ai < authRows.length && ai < authLabels.length; ai++) {
      var spanEl = authRows[ai].querySelector('span');
      if (spanEl) spanEl.textContent = t(authLabels[ai]);
    }
    // Toolbar buttons
    if (btnExportJSON) btnExportJSON.textContent = t('exportJSON');
    if (btnExportCSV) btnExportCSV.textContent = t('exportCSV');
    if (btnHistory) btnHistory.textContent = t('historyOpen');
    if (recordLabel) {
      recordLabel.textContent = _history && _history.isRecording()
        ? t('historyRecording') : t('historyStart');
    }
    if (historyModalTitle) historyModalTitle.textContent = t('historyTitle');
    if (profileLabel) profileLabel.textContent = t('historyProfile') + ':';
    if (btnNewProfile) btnNewProfile.title = t('historyNewProfile');
    if (btnDeleteProfile) btnDeleteProfile.title = t('historyDeleteProfile');
    if (btnClearHistory) btnClearHistory.textContent = t('historyClear');
    if (btnExportHistory) btnExportHistory.textContent = t('historyExport');
    if (btnInstall && btnInstall.style.display !== 'none') {
      btnInstall.textContent = t('installApp');
    }
    // Rebuild observable labels
    var psyLabels = document.querySelectorAll('.psy-label[data-psy]');
    for (var pi = 0; pi < psyLabels.length; pi++) {
      var key = psyLabels[pi].getAttribute('data-psy');
      if (key) psyLabels[pi].textContent = ql(key);
    }
    // Force re-render of cached HTML
    _lastExprHTML = '';
    _lastTransHTML = '';
    _lastMicroHTML = '';
  }

  /* ═══ History Panel Helpers ═══ */

  /** Disable all history-related buttons and show user feedback when IndexedDB is unavailable */
  function disableHistoryUI() {
    var btns = [btnRecordToggle, btnHistory, btnExportHistory];
    for (var i = 0; i < btns.length; i++) {
      if (btns[i]) {
        btns[i].disabled = true;
        btns[i].style.opacity = '0.4';
        btns[i].style.pointerEvents = 'none';
        btns[i].title = t('historyUnavailable');
      }
    }
    // Visible feedback for mobile (no hover → no tooltip)
    if (statusLine) {
      var prev = statusLine.textContent;
      statusLine.textContent = t('historyUnavailable');
      setTimeout(function () {
        // Restore only if unchanged (camera status may have overwritten already)
        if (statusLine.textContent === t('historyUnavailable')) {
          statusLine.textContent = prev;
        }
      }, 3000);
    }
  }

  function loadProfiles() {
    if (!_history) return;
    _history.getProfiles().then(function (profiles) {
      profileSelect.innerHTML = '';
      if (profiles.length === 0) {
        // Create default profile
        var def = { id: 'default', name: t('historyDefaultName'), created: Date.now() };
        _history.saveProfile(def).then(function () {
          _currentProfileId = 'default';
          var opt = document.createElement('option');
          opt.value = def.id;
          opt.textContent = def.name;
          profileSelect.appendChild(opt);
        }).catch(function () { /* storage write failed — skip */ });
        return;
      }
      for (var i = 0; i < profiles.length; i++) {
        var opt = document.createElement('option');
        opt.value = profiles[i].id;
        opt.textContent = profiles[i].name;
        profileSelect.appendChild(opt);
      }
      if (!_currentProfileId) _currentProfileId = profiles[0].id;
      profileSelect.value = _currentProfileId;
    }).catch(function () { /* DB read failed — history unavailable */ });
  }

  function fmtDuration(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function loadSessions() {
    if (!_history || !_currentProfileId) return;
    _history.getSessions(_currentProfileId).then(function (sessions) {
      sessionList.innerHTML = '';
      if (sessions.length === 0) {
        sessionList.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">' +
          t('historyNoData') + '</div>';
        trendSummary.innerHTML = '';
        return;
      }
      // Show trend
      var trend = HIST.computeTrend(sessions);
      if (trend) {
        var tHTML = '<div class="trend-label">' + t('historyTrend') +
          ' (' + trend.sessionCount + ' ' + t('historySession') +
          ', ' + trend.totalFrames + ' ' + t('historyFrames') + ')</div>';
        var psyKeys = CFG.OBSERVABLE_KEYS;
        for (var tk = 0; tk < psyKeys.length; tk++) {
          var k = psyKeys[tk];
          var dir = trend.trendDirection[k] || 'stable';
          var dirText = dir === 'up' ? t('historyTrendUp')
            : dir === 'down' ? t('historyTrendDown') : t('historyTrendStable');
          var dirClass = 'trend-' + dir;
          tHTML += '<div>' + ql(k) + ': <span class="trend-val">' +
            (trend.avgObservables[k] * 100).toFixed(0) + '%</span> ' +
            '<span class="' + dirClass + '">' + dirText + '</span></div>';
        }
        trendSummary.innerHTML = tHTML;
      }
      // List sessions (newest first)
      sessions.sort(function (a, b) { return b.startTime - a.startTime; });
      for (var si = 0; si < sessions.length; si++) {
        var sess = sessions[si];
        var dur = (sess.endTime || sess.startTime) - sess.startTime;
        var dateStr = new Date(sess.startTime).toLocaleString();
        var div = document.createElement('div');
        div.className = 'session-item';
        div.innerHTML =
          '<div class="session-meta"><span>' + dateStr + '</span>' +
          '<span>' + t('historyDuration') + ': ' + fmtDuration(dur) + '</span></div>' +
          '<div class="session-stats">' +
          '<span class="session-stat">' + t('historyFrames') + ': <strong>' +
          (sess.snapshots ? sess.snapshots.length : 0) + '</strong></span></div>';
        sessionList.appendChild(div);
      }
    }).catch(function () { /* session read failed */ });
  }

  /* ═══ Init ═══ */
  function init() {
    /* Adaptive canvas size to match camera resolution */
    if (_qualityMode === 'high') { canvas.width = 640; canvas.height = 480; }
    else if (_qualityMode === 'medium') { canvas.width = 480; canvas.height = 360; }
    else { canvas.width = 320; canvas.height = 240; }
    buildAURows();
    buildPsyRows();

    // ── Apply i18n to all static UI text (respects persisted locale) ──
    refreshUIText();

    // ── Update HTML lang attribute to match locale ──
    document.documentElement.lang = I18n ? I18n.getLocale() : 'en';

    // ── Initialize History ──
    if (HIST) {
      _history = HIST.create();
      _history.init().then(function () {
        loadProfiles();
      }).catch(function () {
        /* IndexedDB unavailable (private mode / restricted browser) — history disabled */
        _history = null;
        disableHistoryUI();
      });
    }

    // ── Toolbar: Language Toggle ──
    if (btnLang && I18n) {
      btnLang.addEventListener('click', function () {
        var cur = I18n.getLocale();
        var next = cur === 'zh-CN' ? 'en-US' : 'zh-CN';
        I18n.setLocale(next);
        document.documentElement.lang = next === 'zh-CN' ? 'zh-CN' : 'en';
        refreshUIText();
        // Re-render dashboard with new language
        if (_lastResult) updateDashboard(_lastResult);
      });
    }

    // ── Toolbar: Export ──
    if (btnExportJSON && EXP) {
      btnExportJSON.addEventListener('click', function () {
        if (_lastResult) EXP.downloadJSON(_lastResult);
      });
    }
    if (btnExportCSV && EXP) {
      btnExportCSV.addEventListener('click', function () {
        if (_lastResult) EXP.downloadCSV(_lastResult);
      });
    }

    // ── Toolbar: Record Toggle ──
    if (btnRecordToggle && _history) {
      btnRecordToggle.addEventListener('click', function () {
        if (!_history) return; // graceful degradation if init failed
        if (_history.isRecording()) {
          // Stop
          _history.endSession().then(function () {
            btnRecordToggle.classList.remove('recording');
            recordLabel.textContent = t('historyStart');
          }).catch(function () {
            btnRecordToggle.classList.remove('recording');
            recordLabel.textContent = t('historyStart');
          });
        } else {
          // Start
          if (!_currentProfileId) _currentProfileId = 'default';
          _history.startSession(_currentProfileId);
          btnRecordToggle.classList.add('recording');
          recordLabel.textContent = t('historyRecording');
        }
      });
    }

    // ── History Modal ──
    if (btnHistory) {
      btnHistory.addEventListener('click', function () {
        historyModal.style.display = 'flex';
        loadSessions();
      });
    }
    if (btnCloseHistory) {
      btnCloseHistory.addEventListener('click', function () {
        historyModal.style.display = 'none';
      });
    }
    if (historyModal) {
      historyModal.addEventListener('click', function (e) {
        if (e.target === historyModal) historyModal.style.display = 'none';
      });
    }
    // Keyboard: Escape to close modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && historyModal && historyModal.style.display !== 'none') {
        historyModal.style.display = 'none';
      }
    });

    // ── Profile management ──
    if (profileSelect) {
      profileSelect.addEventListener('change', function () {
        _currentProfileId = profileSelect.value;
        loadSessions();
      });
    }
    if (btnNewProfile && _history) {
      btnNewProfile.addEventListener('click', function () {
        if (!_history) return;
        var name = prompt(t('historyNewProfile'));
        if (!name) return;
        var id = 'p_' + Date.now();
        _history.saveProfile({ id: id, name: name, created: Date.now() }).then(function () {
          _currentProfileId = id;
          loadProfiles();
        }).catch(function () { /* storage write failed */ });
      });
    }
    if (btnDeleteProfile && _history) {
      btnDeleteProfile.addEventListener('click', function () {
        if (!_history || !_currentProfileId) return;
        if (!confirm(t('historyConfirmDelete'))) return;
        _history.deleteProfile(_currentProfileId).then(function () {
          _currentProfileId = null;
          loadProfiles();
          loadSessions();
        }).catch(function () { /* delete failed */ });
      });
    }
    if (btnClearHistory && _history) {
      btnClearHistory.addEventListener('click', function () {
        if (!_history || !_currentProfileId) return;
        if (!confirm(t('historyConfirmClear'))) return;
        _history.clearProfile(_currentProfileId).then(function () {
          loadSessions();
        }).catch(function () { /* clear failed */ });
      });
    }
    if (btnExportHistory && EXP && _history) {
      btnExportHistory.addEventListener('click', function () {
        if (!_history || !_currentProfileId) return;
        _history.getSessions(_currentProfileId).then(function (sessions) {
          var name = profileSelect.options[profileSelect.selectedIndex]
            ? profileSelect.options[profileSelect.selectedIndex].textContent
            : 'history';
          EXP.downloadHistoryJSON(sessions, name);
        }).catch(function () { /* read failed */ });
      });
    }

    // ── Camera setup ──
    if (!POL.canUseCameraContext()) {
      statusLine.textContent = t('statusNeedHTTPS');
      return;
    }

    statusLine.textContent = t('statusScanning');

    /* Adaptive resolution: lower on mobile / low-end to save battery & CPU */
    var camW, camH;
    if (_qualityMode === 'high') { camW = 640; camH = 480; }
    else if (_qualityMode === 'medium') { camW = 480; camH = 360; }
    else { camW = 320; camH = 240; }

    /* global FaceMesh, Camera */
    var faceMesh = new FaceMesh({
      locateFile: function (file) {
        return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/' + file;
      },
    });
    faceMesh.setOptions({
      maxNumFaces:      1,
      refineLandmarks:  true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence:  0.5,
    });
    faceMesh.onResults(onResults);

    var cameraOpts = {
      onFrame: function () { return faceMesh.send({ image: video }); },
      width: camW,
      height: camH,
    };
    /* On mobile: prefer front camera */
    if (_isMobile) {
      cameraOpts.facingMode = 'user';
    }
    var camera = new Camera(video, cameraOpts);
    camera.start().catch(function (err) {
      statusLine.textContent = POL.getCameraErrorMessage(err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
