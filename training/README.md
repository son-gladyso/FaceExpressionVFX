# Optional learned AU provider

FaceVFX does not bundle or claim a trained AU classifier. `face-model-adapter.js` only enables a provider that supplies model name, version, license, training-data provenance, AU label mapping, and evaluation metrics. Predictions are quality-weighted and capped; deterministic geometry rules remain the fallback.

Before training, verify consent and dataset/model licenses, use subject-disjoint train/validation/test splits, freeze preprocessing, publish per-AU and subgroup error statistics, and document intended/forbidden uses. A model without complete provenance must remain disabled.
