/* ═══════════════════════════════════════════════════════════════
 *  face-policies.js  –  Camera & Quality Policies
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function isLocalHost() {
    if (typeof location === 'undefined') return true;
    var h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '';
  }

  function canUseCameraContext() {
    if (typeof navigator === 'undefined') return false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    if (typeof location === 'undefined') return true;
    return location.protocol === 'https:' || isLocalHost();
  }

  function resolveQualityMode(hw) {
    if (!hw) return 'low';
    var cores = hw.hardwareConcurrency || 2;
    var mem   = hw.deviceMemory || 2;
    if (cores >= 8 && mem >= 8) return 'high';
    if (cores >= 4 && mem >= 4) return 'medium';
    return 'low';
  }

  function _t(k) { return global.FaceI18n ? global.FaceI18n.t(k) : k; }

  function getCameraErrorMessage(err) {
    if (!err) return _t('cameraUnknown');
    var name = err.name || '';
    if (name === 'NotAllowedError')  return _t('cameraNotAllowed');
    if (name === 'NotFoundError')    return _t('cameraNotFound');
    if (name === 'NotReadableError') return _t('cameraNotReadable');
    return _t('cameraError') + (err.message || name);
  }

  global.FacePolicies = Object.freeze({
    isLocalHost:           isLocalHost,
    canUseCameraContext:   canUseCameraContext,
    resolveQualityMode:    resolveQualityMode,
    getCameraErrorMessage: getCameraErrorMessage,
  });
})(typeof window !== 'undefined' ? window : globalThis);
