/* FaceVFX v3.11 observable-only JSON/CSV export. */
(function (global) {
  'use strict';

  function fmtTime(date) {
    var d = date || new Date();
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  function triggerDownload(content, filename, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function flattenResult(result) {
    if (!result) return {};
    var flat = {
      timestamp: new Date().toISOString(),
      schemaVersion: result.schemaVersion || '3.11.0',
      paused: result.paused ? 1 : 0,
      quality_score: result.quality ? result.quality.score.toFixed(4) : '',
      quality_action: result.quality ? result.quality.action : '',
      quality_flags: result.quality ? result.quality.reasons.join('|') : '',
      temporal_state: result.temporal ? result.temporal.label : '',
      temporal_confidence: result.temporal ? result.temporal.confidence.toFixed(4) : '',
      temporal_uncertainty: result.temporal ? result.temporal.entropy.toFixed(4) : '',
      inference_source: result.inferenceSource || 'rules',
      calibrated: result.calibrated ? 1 : 0,
    };
    var CFG = global.FaceConfig;
    if (CFG && result.auEstimates) {
      for (var i = 0; i < CFG.AU_LIST.length; i++) {
        var key = CFG.AU_LIST[i];
        var estimate = result.auEstimates[key];
        if (!estimate) continue;
        flat[key + '_value'] = estimate.value.toFixed(4);
        flat[key + '_lower'] = estimate.lower.toFixed(4);
        flat[key + '_upper'] = estimate.upper.toFixed(4);
        flat[key + '_confidence'] = estimate.confidence.toFixed(4);
      }
    }
    if (CFG && result.observables) {
      for (var o = 0; o < CFG.OBSERVABLE_KEYS.length; o++) {
        var observable = CFG.OBSERVABLE_KEYS[o];
        var interval = result.observables.intervals[observable];
        if (!interval) continue;
        flat['observable_' + observable] = interval.value.toFixed(4);
        flat['observable_' + observable + '_lower'] = interval.lower.toFixed(4);
        flat['observable_' + observable + '_upper'] = interval.upper.toFixed(4);
        flat['observable_' + observable + '_confidence'] = interval.confidence.toFixed(4);
      }
    }
    if (result.headPose) {
      flat.headPose_yaw = result.headPose.yaw.toFixed(2);
      flat.headPose_pitch = result.headPose.pitch.toFixed(2);
      flat.headPose_roll = result.headPose.roll.toFixed(2);
    }
    flat.blinkCount = result.blinkCount || 0;
    return flat;
  }

  function buildCSV(rows) {
    if (!rows || rows.length === 0) return '';
    var keys = Object.keys(rows[0]);
    var lines = [keys.join(',')];
    for (var i = 0; i < rows.length; i++) {
      var values = [];
      for (var j = 0; j < keys.length; j++) {
        var value = rows[i][keys[j]];
        var text = value == null ? '' : String(value);
        if (/[",\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
        values.push(text);
      }
      lines.push(values.join(','));
    }
    return lines.join('\n');
  }

  function buildSnapshot(result) {
    if (!result) return null;
    return {
      timestamp: new Date().toISOString(),
      schemaVersion: result.schemaVersion || '3.11.0',
      notice: 'Observable facial geometry estimates only; not identity, intent, truthfulness, or diagnosis.',
      paused: Boolean(result.paused),
      quality: result.quality || null,
      calibration: result.calibration || null,
      auEstimates: result.auEstimates || {},
      observables: result.observables || null,
      temporal: result.temporal || null,
      headPose: result.headPose || null,
      blinkCount: result.blinkCount || 0,
      inference: {
        source: result.inferenceSource || 'rules',
        modelWeight: result.modelWeight || 0,
        modelMetadata: result.modelMetadata || null,
      },
    };
  }

  function flattenLightSnapshot(snapshot) {
    if (!snapshot) return {};
    var flat = {
      timestamp: snapshot.t ? new Date(snapshot.t).toISOString() : '',
      quality_score: snapshot.q == null ? '' : Number(snapshot.q).toFixed(4),
      quality_action: snapshot.qa || '',
      temporal_state: snapshot.ts || '',
      temporal_uncertainty: snapshot.tu == null ? '' : Number(snapshot.tu).toFixed(4),
    };
    var CFG = global.FaceConfig;
    if (CFG && snapshot.obs) {
      for (var i = 0; i < CFG.OBSERVABLE_KEYS.length; i++) {
        var key = CFG.OBSERVABLE_KEYS[i];
        flat['observable_' + key] = Number(snapshot.obs[key] || 0).toFixed(4);
      }
    }
    if (snapshot.hp) {
      flat.headPose_yaw = Number(snapshot.hp.y || 0).toFixed(2);
      flat.headPose_pitch = Number(snapshot.hp.p || 0).toFixed(2);
      flat.headPose_roll = Number(snapshot.hp.r || 0).toFixed(2);
    }
    return flat;
  }

  function downloadJSON(result) {
    triggerDownload(JSON.stringify(buildSnapshot(result), null, 2),
      'face-observables_' + fmtTime() + '.json', 'application/json');
  }
  function downloadCSV(result) {
    triggerDownload(buildCSV([flattenResult(result)]),
      'face-observables_' + fmtTime() + '.csv', 'text/csv');
  }
  function downloadHistoryJSON(sessions, profileName) {
    triggerDownload(JSON.stringify({
      exportTime: new Date().toISOString(), profile: profileName || 'unknown', sessions: sessions || [],
    }, null, 2), 'face-history_' + fmtTime() + '.json', 'application/json');
  }
  function downloadHistoryCSV(sessions) {
    var rows = [];
    for (var i = 0; i < (sessions || []).length; i++) {
      for (var j = 0; j < (sessions[i].snapshots || []).length; j++) {
        var row = flattenLightSnapshot(sessions[i].snapshots[j]);
        row.sessionId = sessions[i].id || i;
        rows.push(row);
      }
    }
    if (rows.length) triggerDownload(buildCSV(rows), 'face-history_' + fmtTime() + '.csv', 'text/csv');
  }

  global.FaceExport = Object.freeze({
    buildSnapshot: buildSnapshot,
    flattenResult: flattenResult,
    flattenLightSnapshot: flattenLightSnapshot,
    buildCSV: buildCSV,
    downloadJSON: downloadJSON,
    downloadCSV: downloadCSV,
    downloadHistoryJSON: downloadHistoryJSON,
    downloadHistoryCSV: downloadHistoryCSV,
  });
})(typeof window !== 'undefined' ? window : globalThis);
