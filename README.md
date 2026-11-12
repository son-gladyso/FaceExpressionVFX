# FaceExpressionVFX v3.11

[简体中文](docs/i18n/README.zh-CN.md) · [English](README.md) · [日本語](docs/i18n/README.ja.md) · [한국어](docs/i18n/README.ko.md) · [Español](docs/i18n/README.es.md) · [Français](docs/i18n/README.fr.md) · [Deutsch](docs/i18n/README.de.md) · [Português (Brasil)](docs/i18n/README.pt-BR.md) · [Русский](docs/i18n/README.ru.md) · [繁體中文](docs/i18n/README.zh-TW.md)

> Most face demos show you a confident number: *"Happiness 87%."* They don't tell you it was computed from a blurry frame, with your head turned 30°, under a desk lamp.
>
> **This one shows the number *and* the reasons to trust it less.** Raise an eyebrow and you'll see a movement estimate with an interval, a confidence score and a quality gate that can down-weight or pause the frame entirely.

An experimental, local-first browser workbench for developers exploring **FACS-inspired facial action-unit (AU) geometry**. It reports observable movement and uncertainty, and nothing else: no identity, intent, emotion, truthfulness, personality, or medical or psychological diagnosis.

[First experiment](#first-experiment) · [Run locally](#run-and-verify) · [Pipeline](#how-the-pipeline-works) · [FAQ](#faq) · [Contribute](#contribute) · [For AI agents](#-for-ai-agents)

---

## 👋 For humans

### First experiment

1. [Start the app](#run-and-verify), sit somewhere well lit and follow the calibration with a neutral face.
2. Make one small visible movement: raise your eyebrows or open your mouth.
3. Watch three things at once: the movement value, its interval, and the quality / confidence indicators.

Then try these comparisons:

| Try | Observe | Do **not** conclude |
| --- | --- | --- |
| Neutral → small brow or mouth movement | Estimates and their intervals | That a value measures emotion, sincerity or intent |
| Frontal view → harder pose or lighting | Quality score, confidence, downweight/pause | That a bad image tells you *more* about the person |
| Start a short recording → export | Local history, JSON/CSV | That the export is a diagnosis or a real-world accuracy report |

The UI has a Chinese/English toggle, History and export controls. Recording is always a deliberate action; you don't need it to explore the live pipeline.

### How the pipeline works

1. **Landmarks:** MediaPipe provides 468+ normalized face landmarks.
2. **Quality gate:** it scores landmark integrity, face bounds/scale, head pose, illumination, contrast, clipping, sharpness and an eye-region visibility/glare proxy.
3. **Pass / downweight / pause:** paused frames can't update AU inference *or* your calibration.
4. **Robust personal baseline:** median + MAD with outlier rejection, and only slow, clipped drift on quiet high-quality frames.
5. **Pose compensation:** head-pose compensation and face-normalized distances reduce pose and stable face-shape effects.
6. **AU estimates:** each returns `value`, `lower`, `upper`, `confidence`, `region`.
7. **Temporal filter:** an explicit-duration Bayesian filter (not frame-count hysteresis) gives posterior confidence and normalized uncertainty.
8. **Observable summaries:** twelve movement summaries (brow, eye, cheek, nose, lip, mouth) with propagated intervals.

**No learned model is bundled.** An optional AU provider only activates if its metadata declares name, version, license, training-data provenance, AU label map and evaluation metrics. Even then its contribution is quality-weighted and capped, and the deterministic geometry stays as the fallback. Deep dive: [ALGORITHM_V3_11.md](ALGORITHM_V3_11.md).

### Run and verify

Needs Node.js/npm, a modern browser, a working camera, `localhost` or HTTPS, and network access for MediaPipe CDN scripts and web fonts. Frames are processed locally, but the first launch isn't offline.

```powershell
npm install
npm run check     # unit/contract tests, deterministic AU metric fixture, ESLint, static release checks
npm start         # static server on :8080 via npx http-server (may download it first)
```

**First win:** in the live calibration/quality panel, make one movement and compare its estimate with the uncertainty display. Passing `npm run check` doesn't replace this camera check.

Evaluation CLI (per-AU precision, recall, F1, false-positive rate, held-out-subject summaries):

```powershell
node scripts/evaluate-au.mjs evaluation/fixtures/synthetic-au-eval.json
```

> The bundled vectors are **synthetic contract tests**. No redistributable, lawfully labeled human-video dataset existed for v3.11, so **no real-video accuracy or cross-person generalization is claimed.** See [evaluation/README.md](evaluation/README.md).

### FAQ

**Is this an emotion detector?** No. Outputs are geometry and movement proxies.
**Why did it pause?** Pose, visibility, lighting or another frame condition failed the gate. Improve the view; a pause is not a finding about the person.
**Does the synthetic eval prove it works on my camera?** No. It checks metric and test contracts.
**Where's my history?** In local IndexedDB, only after you start recording. Exports are local downloads. Treat both as personal data.

### Privacy and limits

Nothing is uploaded by this project. **Do not use it** for identification, surveillance, healthcare, employment, insurance, policing, school discipline or any other high-impact decision. See [PRIVACY.md](PRIVACY.md). MIT licensed; third-party libraries and any future datasets/models keep their own licenses.

### Contribute

Welcome where results can be checked: frame-quality and calibration edge cases, accessible labels and clearer uncertainty wording, translations, AU geometry and temporal regression tests, reproducible evaluation tooling with properly licensed and consented data. Explain the problem, evidence, tests run and what remains unvalidated in your [PR](https://github.com/son-gladyso/FaceExpressionVFX/pulls); discuss big changes in an [issue](https://github.com/son-gladyso/FaceExpressionVFX/issues) first.

---

## 🤖 For AI agents

**Module map:**

| File | Role | Evidence to add when changing it |
| --- | --- | --- |
| `face-quality.js`, `face-policies.js` | Frame gates, AU confidence intervals, policy | Focused regression + expected pass/downweight/pause |
| `face-au-detector.js` | Robust calibration, pose compensation, deterministic AU geometry | Deterministic input sequence + explicit output bounds |
| `face-temporal.js` | Explicit-duration Bayesian state filter | Same as above |
| `face-observables.js` | Twelve observable movement summaries | Interval propagation preserved |
| `face-model-adapter.js` | Provenance-gated optional provider + rule fallback | Metadata gate cannot be bypassed |
| `face-i18n.js`, `index.html` | UI text, language toggle | Both languages; uncertainty preserved |
| `face-history.js`, `face-export.js` | IndexedDB history, JSON/CSV export | Recording stays opt-in and local |
| `scripts/evaluate-au.mjs`, `evaluation/` | Fixed-manifest metrics | Synthetic vs. real-video evidence labeled separately |

**Hard rules:**

- Never add outputs, labels or copy that claim emotion, intent, identity, truthfulness, personality, health or diagnosis. Keep the vocabulary to *observable movement*.
- Paused frames must not update inference or calibration. Every AU must keep `value/lower/upper/confidence/region`.
- Don't let an optional model bypass the provenance/metadata gate or the contribution cap; deterministic geometry stays the fallback.
- Never upload frames, landmarks or history. Recording must stay a deliberate user action.
- Don't present synthetic fixture metrics as real-world accuracy.
- Don't commit face recordings, biometric embeddings, model weights or datasets without explicit rights.

**Verify:** `npm run check`
