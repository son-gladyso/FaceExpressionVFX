# AU evaluation protocol

`scripts/evaluate-au.mjs` computes per-AU precision, recall, F1 and false-positive rate, plus held-out-subject summaries. The included fixture is synthetic and tests the metric contract only.

For a real fixed-video benchmark, create a versioned manifest with stable sample IDs, subject-disjoint splits, frame/AU labels, prediction values, annotator protocol, consent/provenance, and a license permitting this use. Keep videos outside Git unless redistribution is explicitly allowed. Record dataset and model versions with every report.

No lawful human-video annotations were present during v3.11 development, so this repository does not claim measured real-world AU accuracy or cross-person generalization.
