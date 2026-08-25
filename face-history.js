/* ═══════════════════════════════════════════════════════════════
 *  face-history.js  –  Persistent History & Profile Manager
 *  Uses IndexedDB for per-person storage with trend analysis.
 *  Usage:
 *    var hist = FaceHistory.create();
 *    hist.init().then(function(){ ... });
 *    hist.startSession(profileId);
 *    hist.addSnapshot(result);   // call periodically
 *    hist.endSession();
 *    hist.getSessions(profileId).then(...)
 *    hist.clearProfile(profileId).then(...)
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var DB_NAME = 'FaceExpressionHistory';
  var DB_VERSION = 1;
  var STORE_PROFILES = 'profiles';
  var STORE_SESSIONS = 'sessions';

  /* ═══ IndexedDB Helpers ═══ */
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_PROFILES)) {
          db.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          var store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('profileId', 'profileId', { unique: false });
          store.createIndex('startTime', 'startTime', { unique: false });
        }
      };
      request.onsuccess = function (e) { resolve(e.target.result); };
      request.onerror = function (e) { reject(e.target.error); };
    });
  }

  function getAllFromStore(db, storeName) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readonly');
      var store = tx.objectStore(storeName);
      var req = store.getAll();
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function getByIndex(db, storeName, indexName, value) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readonly');
      var store = tx.objectStore(storeName);
      var idx = store.index(indexName);
      var req = idx.getAll(value);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function putItem(db, storeName, item) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var store = tx.objectStore(storeName);
      var req = store.put(item);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function deleteItem(db, storeName, key) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var store = tx.objectStore(storeName);
      var req = store.delete(key);
      req.onsuccess = function () { resolve(); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function clearStore(db, storeName) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var store = tx.objectStore(storeName);
      var req = store.clear();
      req.onsuccess = function () { resolve(); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  /* ═══ Snapshot Sampler ═══
   *  Captures a lightweight snapshot every N frames to limit storage.
   */
  var SNAPSHOT_INTERVAL_MS = 2000; // sample every 2 seconds

  function buildLightSnapshot(result) {
    if (!result) return null;
    var snap = {
      t: Date.now(),
      expr: result.topExpr || 'neutral',
      conf: +(result.topConf || 0).toFixed(3),
      psy: {},
    };
    // Psychology dimensions (rounded)
    if (result.psychology) {
      var CFG = global.FaceConfig;
      if (CFG) {
        var keys = CFG.PSYCHOLOGY_KEYS;
        for (var i = 0; i < keys.length; i++) {
          snap.psy[keys[i]] = +((result.psychology[keys[i]] || 0).toFixed(3));
        }
      }
    }
    // Authenticity
    if (result.authenticity) {
      snap.auth = +(result.authenticity.overall || 0).toFixed(3);
    }
    // Blink
    if (result.blinkAnalysis) {
      snap.blinkRate = +(result.blinkAnalysis.rate || 0).toFixed(1);
    }
    // Head pose
    if (result.headPose) {
      snap.hp = {
        y: +result.headPose.yaw.toFixed(1),
        p: +result.headPose.pitch.toFixed(1),
        r: +result.headPose.roll.toFixed(1),
      };
    }
    return snap;
  }

  /* ═══ Trend Analysis ═══ */
  function computeTrend(sessions) {
    if (!sessions || sessions.length === 0) return null;
    var CFG = global.FaceConfig;
    var psyKeys = CFG ? CFG.PSYCHOLOGY_KEYS : [];

    var trend = {
      sessionCount: sessions.length,
      totalFrames: 0,
      totalDurationMs: 0,
      avgPsy: {},
      trendDirection: {},  // per-dimension: 'up' | 'down' | 'stable'
      topExpressions: {},
    };

    // Aggregate per-session averages
    var sessionAvgs = [];
    for (var si = 0; si < sessions.length; si++) {
      var sess = sessions[si];
      var snaps = sess.snapshots || [];
      trend.totalFrames += snaps.length;
      trend.totalDurationMs += (sess.endTime || sess.startTime) - sess.startTime;

      var sessAvg = {};
      for (var ki = 0; ki < psyKeys.length; ki++) sessAvg[psyKeys[ki]] = 0;

      for (var sn = 0; sn < snaps.length; sn++) {
        var snap = snaps[sn];
        // Expression frequency
        if (snap.expr) {
          trend.topExpressions[snap.expr] = (trend.topExpressions[snap.expr] || 0) + 1;
        }
        // Psychology accumulation
        if (snap.psy) {
          for (var pk = 0; pk < psyKeys.length; pk++) {
            sessAvg[psyKeys[pk]] += (snap.psy[psyKeys[pk]] || 0);
          }
        }
      }
      // Normalize
      if (snaps.length > 0) {
        for (var nk = 0; nk < psyKeys.length; nk++) {
          sessAvg[psyKeys[nk]] /= snaps.length;
        }
      }
      sessionAvgs.push(sessAvg);
    }

    // Overall averages
    for (var ak = 0; ak < psyKeys.length; ak++) {
      var k = psyKeys[ak];
      var sum = 0;
      for (var sa = 0; sa < sessionAvgs.length; sa++) sum += sessionAvgs[sa][k];
      trend.avgPsy[k] = sessionAvgs.length > 0 ? sum / sessionAvgs.length : 0;
    }

    // Trend direction (compare first half vs second half)
    if (sessionAvgs.length >= 2) {
      var mid = Math.floor(sessionAvgs.length / 2);
      for (var tk = 0; tk < psyKeys.length; tk++) {
        var key = psyKeys[tk];
        var firstHalf = 0, secondHalf = 0;
        for (var fh = 0; fh < mid; fh++) firstHalf += sessionAvgs[fh][key];
        firstHalf /= mid;
        var secondCount = sessionAvgs.length - mid;
        for (var sh = mid; sh < sessionAvgs.length; sh++) secondHalf += sessionAvgs[sh][key];
        secondHalf /= secondCount;

        var diff = secondHalf - firstHalf;
        if (diff > 0.05) trend.trendDirection[key] = 'up';
        else if (diff < -0.05) trend.trendDirection[key] = 'down';
        else trend.trendDirection[key] = 'stable';
      }
    }

    return trend;
  }

  /* ═══ History Instance Factory ═══ */
  function create() {
    var _db = null;
    var _currentSession = null;
    var _lastSnapshotTime = 0;

    return {
      /** Initialize DB connection */
      init: function () {
        return openDB().then(function (db) {
          _db = db;
        });
      },

      /** Get all profiles */
      getProfiles: function () {
        if (!_db) return Promise.resolve([]);
        return getAllFromStore(_db, STORE_PROFILES);
      },

      /** Create or update a profile */
      saveProfile: function (profile) {
        if (!_db) return Promise.resolve();
        return putItem(_db, STORE_PROFILES, profile);
      },

      /** Delete a profile and all its sessions */
      deleteProfile: function (profileId) {
        if (!_db) return Promise.resolve();
        var db = _db;
        // Delete sessions first
        return getByIndex(db, STORE_SESSIONS, 'profileId', profileId)
          .then(function (sessions) {
            var promises = [];
            for (var i = 0; i < sessions.length; i++) {
              promises.push(deleteItem(db, STORE_SESSIONS, sessions[i].id));
            }
            return Promise.all(promises);
          })
          .then(function () {
            return deleteItem(db, STORE_PROFILES, profileId);
          });
      },

      /** Start a new recording session */
      startSession: function (profileId) {
        _currentSession = {
          profileId: profileId,
          startTime: Date.now(),
          endTime: null,
          snapshots: [],
        };
        _lastSnapshotTime = 0;
      },

      /** Add a snapshot from current pipeline result (throttled) */
      addSnapshot: function (result) {
        if (!_currentSession) return;
        var now = Date.now();
        if (now - _lastSnapshotTime < SNAPSHOT_INTERVAL_MS) return;
        _lastSnapshotTime = now;
        var snap = buildLightSnapshot(result);
        if (snap) _currentSession.snapshots.push(snap);
      },

      /** End current session and save to DB */
      endSession: function () {
        if (!_currentSession || !_db) return Promise.resolve();
        _currentSession.endTime = Date.now();
        var sess = _currentSession;
        _currentSession = null;
        if (sess.snapshots.length === 0) return Promise.resolve();
        return putItem(_db, STORE_SESSIONS, sess);
      },

      /** Check if currently recording */
      isRecording: function () {
        return _currentSession !== null;
      },

      /** Get sessions for a profile */
      getSessions: function (profileId) {
        if (!_db) return Promise.resolve([]);
        return getByIndex(_db, STORE_SESSIONS, 'profileId', profileId);
      },

      /** Get all sessions */
      getAllSessions: function () {
        if (!_db) return Promise.resolve([]);
        return getAllFromStore(_db, STORE_SESSIONS);
      },

      /** Clear sessions for a profile */
      clearProfile: function (profileId) {
        if (!_db) return Promise.resolve();
        return getByIndex(_db, STORE_SESSIONS, 'profileId', profileId)
          .then(function (sessions) {
            var promises = [];
            for (var i = 0; i < sessions.length; i++) {
              promises.push(deleteItem(_db, STORE_SESSIONS, sessions[i].id));
            }
            return Promise.all(promises);
          });
      },

      /** Clear all sessions and profiles */
      clearAll: function () {
        if (!_db) return Promise.resolve();
        return Promise.all([
          clearStore(_db, STORE_SESSIONS),
          clearStore(_db, STORE_PROFILES),
        ]);
      },

      /** Compute trend for a profile */
      computeTrend: function (profileId) {
        if (!_db) return Promise.resolve(null);
        return getByIndex(_db, STORE_SESSIONS, 'profileId', profileId)
          .then(function (sessions) {
            return computeTrend(sessions);
          });
      },

      /** Delete a specific session */
      deleteSession: function (sessionId) {
        if (!_db) return Promise.resolve();
        return deleteItem(_db, STORE_SESSIONS, sessionId);
      },
    };
  }

  global.FaceHistory = Object.freeze({
    create:       create,
    computeTrend: computeTrend,
  });
})(typeof window !== 'undefined' ? window : globalThis);
