/* ═══════════════════════════════════════════════════════════════
 *  face-export.js  –  Data Export Module
 *  Exports analysis results as JSON or CSV via browser download.
 *  Usage:  FaceExport.downloadJSON(result)
 *          FaceExport.downloadCSV(result)
 *          FaceExport.downloadHistoryJSON(sessions)
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ═══ Timestamp Formatter ═══ */
  function fmtTime(date) {
    var d = date || new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  /* ═══ Trigger Browser Download ═══ */
  function triggerDownload(content, filename, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  /* ═══ Flatten Pipeline Result for CSV ═══ */
  function flattenResult(result) {
    if (!result) return {};
    var flat = {};
    flat.timestamp = new Date().toISOString();
    flat.topExpression = result.topExpr || '';
    flat.topConfidence = result.topConf || 0;

    // AUs
    var CFG = global.FaceConfig;
    if (CFG && result.aus) {
      var auList = CFG.AU_LIST;
      for (var i = 0; i < auList.length; i++) {
        flat['au_' + auList[i]] = (result.aus[auList[i]] || 0).toFixed(4);
      }
    }

    // Psychology dimensions
    if (CFG && result.psychology) {
      var psyKeys = CFG.PSYCHOLOGY_KEYS;
      for (var p = 0; p < psyKeys.length; p++) {
        flat['psy_' + psyKeys[p]] = (result.psychology[psyKeys[p]] || 0).toFixed(4);
      }
    }

    // Authenticity
    if (result.authenticity) {
      flat.authenticity_overall = (result.authenticity.overall || 0).toFixed(4);
      if (result.authenticity.factors) {
        var fKeys = ['duchenne', 'temporal', 'symmetry', 'duration', 'muscleConflict', 'leakage'];
        for (var f = 0; f < fKeys.length; f++) {
          flat['auth_' + fKeys[f]] = (result.authenticity.factors[fKeys[f]] || 0).toFixed(4);
        }
      }
    }

    // Head pose
    if (result.headPose) {
      flat.headPose_yaw = result.headPose.yaw.toFixed(2);
      flat.headPose_pitch = result.headPose.pitch.toFixed(2);
      flat.headPose_roll = result.headPose.roll.toFixed(2);
    }

    // Blink
    flat.blinkCount = result.blinkCount || 0;
    if (result.blinkAnalysis) {
      flat.blinkRate = (result.blinkAnalysis.rate || 0).toFixed(2);
      flat.perclos = (result.blinkAnalysis.perclos || 0).toFixed(4);
    }

    flat.calibrated = result.calibrated ? 1 : 0;

    return flat;
  }

  /* ═══ Build CSV String from Flat Objects ═══ */
  function buildCSV(rows) {
    if (!rows || rows.length === 0) return '';
    var keys = Object.keys(rows[0]);
    var lines = [keys.join(',')];
    for (var i = 0; i < rows.length; i++) {
      var vals = [];
      for (var k = 0; k < keys.length; k++) {
        var v = rows[i][keys[k]];
        if (v === undefined || v === null) v = '';
        // Escape commas / quotes
        var s = String(v);
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
          s = '"' + s.replace(/"/g, '""') + '"';
        }
        vals.push(s);
      }
      lines.push(vals.join(','));
    }
    return lines.join('\n');
  }

  /* ═══ Snapshot: build a clean export object from current result ═══ */
  function buildSnapshot(result) {
    if (!result) return null;
    return {
      timestamp: new Date().toISOString(),
      topExpression: result.topExpr,
      topConfidence: result.topConf,
      expressions: result.expressions ? result.expressions.slice(0, 8) : [],
      aus: result.aus ? Object.assign({}, result.aus) : {},
      psychology: result.psychology ? Object.assign({}, result.psychology) : {},
      authenticity: result.authenticity ? {
        overall: result.authenticity.overall,
        factors: result.authenticity.factors ?
          Object.assign({}, result.authenticity.factors) : {},
      } : null,
      headPose: result.headPose ? {
        yaw: result.headPose.yaw,
        pitch: result.headPose.pitch,
        roll: result.headPose.roll,
      } : null,
      blinkCount: result.blinkCount || 0,
      blinkAnalysis: result.blinkAnalysis ? {
        rate: result.blinkAnalysis.rate,
        perclos: result.blinkAnalysis.perclos,
      } : null,
      calibrated: !!result.calibrated,
    };
  }

  /* ═══ Public API ═══ */

  /** Download current result snapshot as JSON */
  function downloadJSON(result) {
    var snapshot = buildSnapshot(result);
    if (!snapshot) return;
    var json = JSON.stringify(snapshot, null, 2);
    triggerDownload(json, 'face-analysis_' + fmtTime() + '.json', 'application/json');
  }

  /** Download current result snapshot as CSV (single row) */
  function downloadCSV(result) {
    if (!result) return;
    var flat = flattenResult(result);
    var csv = buildCSV([flat]);
    triggerDownload(csv, 'face-analysis_' + fmtTime() + '.csv', 'text/csv');
  }

  /** Download history sessions array as JSON */
  function downloadHistoryJSON(sessions, profileName) {
    if (!sessions || sessions.length === 0) return;
    var data = {
      exportTime: new Date().toISOString(),
      profile: profileName || 'unknown',
      sessionCount: sessions.length,
      sessions: sessions,
    };
    var json = JSON.stringify(data, null, 2);
    var name = profileName ? profileName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_') : 'history';
    triggerDownload(json, 'face-history_' + name + '_' + fmtTime() + '.json',
      'application/json');
  }

  /* ═══ Flatten Light Snapshot for History CSV ═══
   *  buildLightSnapshot stores abbreviated field names
   *  (t, expr, conf, psy, auth, blinkRate, hp) to save storage.
   *  This function maps them back to full CSV column names.
   */
  function flattenLightSnapshot(snap) {
    if (!snap) return {};
    var flat = {};
    flat.timestamp = snap.t ? new Date(snap.t).toISOString() : '';
    flat.topExpression = snap.expr || '';
    flat.topConfidence = (snap.conf || 0).toFixed(4);

    // Psychology dimensions
    var CFG = global.FaceConfig;
    if (CFG && snap.psy) {
      var psyKeys = CFG.PSYCHOLOGY_KEYS;
      for (var p = 0; p < psyKeys.length; p++) {
        flat['psy_' + psyKeys[p]] = (snap.psy[psyKeys[p]] || 0).toFixed(4);
      }
    }

    // Authenticity
    if (typeof snap.auth === 'number') {
      flat.authenticity_overall = snap.auth.toFixed(4);
    }

    // Blink rate
    if (typeof snap.blinkRate === 'number') {
      flat.blinkRate = snap.blinkRate.toFixed(2);
    }

    // Head pose (abbreviated fields: y/p/r)
    if (snap.hp) {
      flat.headPose_yaw   = (snap.hp.y || 0).toFixed(2);
      flat.headPose_pitch = (snap.hp.p || 0).toFixed(2);
      flat.headPose_roll  = (snap.hp.r || 0).toFixed(2);
    }

    return flat;
  }

  /** Download history sessions as CSV (one row per snapshot) */
  function downloadHistoryCSV(sessions, profileName) {
    if (!sessions || sessions.length === 0) return;
    var allRows = [];
    for (var si = 0; si < sessions.length; si++) {
      var sess = sessions[si];
      var snaps = sess.snapshots || [];
      for (var sn = 0; sn < snaps.length; sn++) {
        var row = flattenLightSnapshot(snaps[sn]);
        row.sessionId = sess.id || si;
        row.sessionStart = sess.startTime || '';
        allRows.push(row);
      }
    }
    if (allRows.length === 0) return;
    var csv = buildCSV(allRows);
    var name = profileName ? profileName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_') : 'history';
    triggerDownload(csv, 'face-history_' + name + '_' + fmtTime() + '.csv', 'text/csv');
  }

  global.FaceExport = Object.freeze({
    buildSnapshot:          buildSnapshot,
    flattenResult:          flattenResult,
    flattenLightSnapshot:   flattenLightSnapshot,
    buildCSV:               buildCSV,
    downloadJSON:           downloadJSON,
    downloadCSV:            downloadCSV,
    downloadHistoryJSON:    downloadHistoryJSON,
    downloadHistoryCSV:     downloadHistoryCSV,
  });
})(typeof window !== 'undefined' ? window : globalThis);
