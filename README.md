# FaceExpressionVFX v3.11

FaceExpressionVFX is a browser-based, local-only experimental visualizer for FACS-inspired facial action-unit (AU) geometry. Version 3.11 reports observable movement estimates and uncertainty; it does not output identity, intent, truthfulness, sincerity, personality, or psychological/medical diagnoses.

## v3.11 algorithm pipeline

1. MediaPipe supplies 468+ normalized face landmarks.
2. A frame-quality gate scores landmark integrity, face bounds/scale, head pose, illumination, contrast, clipping, sharpness, and eye-region visibility/glare proxy.
3. Frames are passed, confidence-downweighted, or paused. Paused frames cannot update AU inference or personal calibration.
4. A robust personal baseline uses medians and median absolute deviation (MAD), rejects low-quality/outlier frames, and applies only slow clipped drift on quiet, high-quality frames.
5. Head-pose compensation and face-normalized distances reduce pose and stable identity-geometry effects before AU calculation.
6. Every AU returns `value`, `lower`, `upper`, `confidence`, and anatomical `region`.
7. An explicit-duration Bayesian temporal filter replaces frame-count hysteresis and reports posterior confidence and normalized uncertainty.
8. Twelve observable movement summaries are derived from the AU estimates with propagated intervals.

No learned model is bundled. An optional AU provider is enabled only when its metadata includes name, version, license, training-data provenance, AU label map, and evaluation metrics. Its contribution is quality-weighted and capped; deterministic geometry rules remain the fallback.

## Run and verify

```powershell
npm install
npm run check
npm start
```

`npm run check` runs unit/contract tests, a deterministic AU metric fixture, ESLint, and static release checks. The evaluation CLI reports per-AU precision, recall, F1 and false-positive rate plus held-out-subject summaries:

```powershell
node scripts/evaluate-au.mjs evaluation/fixtures/synthetic-au-eval.json
```

The bundled vectors are synthetic contract tests, not evidence of real-world accuracy. See [evaluation/README.md](evaluation/README.md) for the fixed-video manifest requirements. No redistributable, lawfully labeled human-video dataset was present for v3.11, so this release makes no real-video accuracy or cross-person-generalization claim.

## Main modules

- `face-quality.js` — frame gates and AU confidence intervals
- `face-au-detector.js` — robust calibration, pose compensation, deterministic AU geometry
- `face-temporal.js` — explicit-duration Bayesian state filter
- `face-observables.js` — directly observable movement summaries
- `face-model-adapter.js` — provenance-gated optional classifier and rule fallback
- `scripts/evaluate-au.mjs` — fixed-manifest AU metrics and subject-held-out reports

## Privacy and limits

Camera frames are processed in the browser. Nothing is uploaded by this project. History is recorded only after the user starts recording and remains in local IndexedDB; exports are explicit local downloads. Do not use FaceExpressionVFX for identification, surveillance, healthcare, employment, insurance, policing, education discipline, or other high-impact decisions. See [PRIVACY.md](PRIVACY.md).

MIT licensed. Third-party libraries and any future datasets/models retain their own licenses.
