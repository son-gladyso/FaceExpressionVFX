# FaceExpressionVFX v3.11

[简体中文](docs/i18n/README.zh-CN.md) · [English](README.md) · [日本語](docs/i18n/README.ja.md) · [한국어](docs/i18n/README.ko.md) · [Español](docs/i18n/README.es.md) · [Français](docs/i18n/README.fr.md) · [Deutsch](docs/i18n/README.de.md) · [Português (Brasil)](docs/i18n/README.pt-BR.md) · [Русский](docs/i18n/README.ru.md) · [繁體中文](docs/i18n/README.zh-TW.md)

**See facial movement estimates together with the reasons to trust them less.**

FaceExpressionVFX is an experimental browser workbench for developers exploring FACS-inspired facial action-unit (AU) geometry. Camera processing stays local; quality gates, calibration, and uncertainty make the pipeline inspectable. Version 3.11 reports observable movement estimates and uncertainty; it does not output identity, intent, truthfulness, sincerity, personality, or psychological/medical diagnoses.

[First experiment](#first-experiment) · [Run locally](#run-and-verify) · [Pipeline](#v311-algorithm-pipeline) · [FAQ](#common-questions) · [Contribute](#help-improve-the-experiment)

## What you can explore

Facial movement demos often show a number without explaining when it becomes unreliable. This project makes the quality checks and uncertainty visible alongside the movement estimates.

- Inspect brow, eye, cheek, nose, lip, and mouth movement summaries.
- See how calibration, head pose, and frame quality affect the output.
- Explore the deterministic rules and tests before adding an optional model.
- Record history only when you choose, then export it as a local download.

It is intended for developers and experimenters who want to study observable facial movement and the limits of a geometry-based pipeline. It does not infer what a person feels or intends.

## First experiment

Use [Run and verify](#run-and-verify) to start the app. Begin with a well-lit, neutral face, follow the calibration flow, then try a small visible movement such as raising your eyebrows or opening your mouth. Watch the quality and uncertainty indicators as well as the movement values.

A useful comparison is a clear frontal view versus a more difficult view. Low-quality frames should be treated as limited evidence, not as stronger conclusions about a face. The documented pipeline can downweight or pause inference.

No real-camera recording is embedded here yet. The bundled synthetic evaluation checks test contracts, not accuracy on human video.

### Three useful things to compare

| Experiment | Observe | Do not conclude |
| --- | --- | --- |
| Neutral face, then a small eyebrow or mouth movement | Movement estimates and their intervals | That a value measures emotion, sincerity, or intent. |
| Frontal view, then a more difficult pose or lighting condition | Quality score, confidence, and pause/downweight behavior | That a poor image provides stronger evidence about the person. |
| Explicitly start a short recording, then export | Local history and JSON/CSV output | That the export is a validated diagnosis or real-world accuracy report. |

The interface includes a Chinese/English toggle, History, and JSON/CSV export controls. Recording is a deliberate action, not a prerequisite for inspecting the live pipeline.

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

Prepare Node.js/npm, a modern camera-capable browser, and a working camera. Run from the repository root. Use `localhost` or HTTPS for camera access, and allow network access for the MediaPipe CDN scripts and web fonts. Local frame processing does not make the first launch fully offline.

```powershell
npm install
npm run check
npm start
```

`npm start` launches a static server on port 8080 and requests that the browser open it. If needed, open `http://localhost:8080` yourself. The command uses `npx http-server`, which may download the server on first use.

**First successful action:** inspect the live calibration/quality panel, make one visible movement, and compare its estimate with the uncertainty display. Passing the command-line checks does not replace this camera check.

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

## Common questions

**Is this an emotion detector?** No. Outputs are geometry and movement proxies, not mental-state labels.

**Why does inference pause or confidence fall?** The quality gate considers pose, visibility, lighting, and other frame conditions. Check the quality indicators and improve the view rather than interpreting a paused result as a negative finding about the person.

**Is a learned AU model included?** No. The bundled pipeline uses deterministic geometry. Optional providers need metadata, provenance, licensing, and evaluation information before they can contribute.

**Does the synthetic evaluation prove accuracy on my camera?** No. It verifies metric/test contracts. Real-video validation requires a suitable, lawfully labeled evaluation set and the fixed-manifest process in [evaluation/README.md](evaluation/README.md).

**Where is recorded history?** In the browser's local IndexedDB after you start recording. Exports are local downloads; treat recordings and exports as personal data even though they are not automatically uploaded.

## Privacy and limits

Camera frames are processed in the browser. Nothing is uploaded by this project. History is recorded only after the user starts recording and remains in local IndexedDB; exports are explicit local downloads. Do not use FaceExpressionVFX for identification, surveillance, healthcare, employment, insurance, policing, education discipline, or other high-impact decisions. See [PRIVACY.md](PRIVACY.md).

MIT licensed. Third-party libraries and any future datasets/models retain their own licenses.

## Help improve the experiment

Contributions are welcome in areas where the result can be checked:

- Frame-quality and calibration edge cases.
- Accessible labels, clearer uncertainty explanations, and translation improvements.
- Regression tests for AU geometry and temporal behavior.
- Reproducible evaluation tooling with appropriately licensed and consented data.

| Contribution area | Files to start with | Useful evidence |
| --- | --- | --- |
| Frame-quality edge cases | `face-quality.js`, `face-policies.js` | A focused regression case and expected pass/downweight/pause behavior. |
| Calibration or AU geometry | `face-au-detector.js`, `face-temporal.js` | A deterministic input sequence and explicit expected output boundaries. |
| Language and UI clarity | `face-i18n.js`, `index.html` | Both language states and an explanation that preserves uncertainty. |
| Evaluation tooling | `scripts/evaluate-au.mjs`, `evaluation/README.md` | Manifest/schema checks; label synthetic and real-video evidence separately. |


Start with the relevant module and `npm run check`. In a [pull request](https://github.com/son-gladyso/FaceExpressionVFX/pulls), explain the problem, the evidence, the tests actually run, and what remains unvalidated. Discuss larger changes in an [issue](https://github.com/son-gladyso/FaceExpressionVFX/issues) before implementing them.

Do not contribute private face recordings, biometric embeddings, model weights, or datasets without the rights and permissions to share them. Preserve the distinction between observable movement and claims about identity, emotions, intent, or health.


