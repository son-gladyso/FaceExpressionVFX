import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/evaluate-au.mjs <manifest.json>');
const manifest = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
if (manifest.schemaVersion !== '1.0' || !Array.isArray(manifest.samples)) {
  throw new Error('Invalid AU evaluation manifest');
}

const threshold = Number.isFinite(manifest.threshold) ? manifest.threshold : 0.5;
const aus = [...new Set(manifest.samples.flatMap((sample) =>
  Object.keys({ ...(sample.labels || {}), ...(sample.predictions || {}) })) )].sort();

function counts(samples, au) {
  const result = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const sample of samples) {
    const actual = Number(sample.labels?.[au] || 0) >= threshold;
    const predicted = Number(sample.predictions?.[au] || 0) >= threshold;
    if (actual && predicted) result.tp++;
    else if (!actual && predicted) result.fp++;
    else if (!actual && !predicted) result.tn++;
    else result.fn++;
  }
  return result;
}

function metrics(c) {
  const precision = c.tp / (c.tp + c.fp || 1);
  const recall = c.tp / (c.tp + c.fn || 1);
  return {
    ...c,
    precision,
    recall,
    f1: 2 * precision * recall / (precision + recall || 1),
    falsePositiveRate: c.fp / (c.fp + c.tn || 1),
  };
}

function summarize(samples) {
  const perAU = Object.fromEntries(aus.map((au) => [au, metrics(counts(samples, au))]));
  const values = Object.values(perAU);
  const mean = (key) => values.reduce((sum, value) => sum + value[key], 0) / (values.length || 1);
  return {
    sampleCount: samples.length,
    perAU,
    macro: {
      precision: mean('precision'), recall: mean('recall'), f1: mean('f1'),
      falsePositiveRate: mean('falsePositiveRate'),
    },
  };
}

const subjects = [...new Set(manifest.samples.map((sample) => sample.subjectId))].sort();
const report = {
  schemaVersion: '1.0',
  dataset: manifest.dataset,
  provenance: manifest.provenance,
  threshold,
  overall: summarize(manifest.samples),
  crossSubject: Object.fromEntries(subjects.map((subjectId) => [
    subjectId,
    {
      heldOut: summarize(manifest.samples.filter((sample) => sample.subjectId === subjectId)),
      developmentCount: manifest.samples.filter((sample) => sample.subjectId !== subjectId).length,
    },
  ])),
};

const out = JSON.stringify(report, null, 2);
if (process.env.FACEVFX_EVAL_OUTPUT) fs.writeFileSync(process.env.FACEVFX_EVAL_OUTPUT, out + '\n');
console.log(out);
