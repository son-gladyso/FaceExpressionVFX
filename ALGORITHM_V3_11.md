# FaceVFX v3.11 algorithm specification

## Output contract

The public pipeline emits capture quality, calibration status, head pose, AU estimates, observable movement summaries, temporal posterior state, blink counts, and model provenance. It does not emit emotion, intent, truthfulness, sincerity, personality, cognitive/psychological state, or diagnosis fields.

Each AU estimate is:

```json
{"value":0.42,"lower":0.29,"upper":0.55,"confidence":0.71,"region":"mouth"}
```

The bounds are quality- and calibration-aware heuristic uncertainty intervals, not population-calibrated statistical coverage guarantees. Real coverage calibration requires a lawful, independently labeled video set.

## Frame quality gate

The gate combines:

- landmark validity, in-frame margin, face scale and head-pose suitability;
- luminance, contrast, clipped-pixel ratio and Laplacian-variance sharpness;
- eye-region texture/clipping as an occlusion or glare/reflection proxy.

It does not infer whether a person wears glasses. Reflections or occlusions commonly associated with eyewear can reduce eye-region confidence. Scores below the hard threshold pause AU output; intermediate scores downweight confidence. A paused frame cannot enter personal calibration.

## Robust personal calibration

The initial neutral baseline uses the median for location and MAD for dispersion. After a minimum warm-up, a frame is rejected when at least 25% of measured channels exceed six robust standard deviations. Once locked, adaptation requires a high-quality, low-activity frame. Residuals are clipped to three robust noise scales and applied with a default drift coefficient of 0.002, preventing a transient expression from rapidly redefining the baseline.

Identity-sensitive ratios—including brow distance, mouth-corner height, lip height, mentalis height and face aspect—are normalized by face width/height and calibrated per user. Distances susceptible to yaw are compensated by the observed pose. This reduces, but cannot fully eliminate, identity geometry and 3D pose confounding from a single monocular landmark stream.

## AU uncertainty

For each AU, confidence combines global capture quality, anatomical-region quality and calibration confidence. Bilateral disagreement adds an AU-specific penalty. The interval half-width grows as confidence falls; blink/wink channels receive an additional width because threshold crossings are especially sensitive to sampling and blur.

## Explicit-duration Bayesian temporal filter

AU activation likelihoods form the observation distribution. The state prior uses elapsed episode duration: it strongly favors staying before the minimum hold, permits transitions after the hold, and relaxes persistence after a maximum duration. Posterior entropy is normalized to `[0,1]` and exposed as temporal uncertainty. This makes switching depend on elapsed milliseconds rather than a fixed number of frames and therefore reduces FPS dependence.

## Learned-model boundary

No trained classifier or human training data is bundled. A provider is rejected unless it declares model/version, license, training-data provenance, AU label mapping and evaluation metrics. Valid predictions are fused only when both model confidence and frame quality are sufficient, and model weight is capped at 0.8. Any error, missing provenance, or low model confidence falls back to deterministic rules.

## Evaluation gate

A release evaluation manifest must be immutable and include sample/subject identifiers, labels, predictions, threshold, dataset provenance and license. The evaluator reports confusion counts, precision, recall, F1 and false-positive rate per AU, macro averages, and held-out-subject summaries. The bundled synthetic manifest verifies this contract only. A real accuracy claim is blocked until a lawful fixed-video set, independent annotations and subject-disjoint evaluation are supplied.
