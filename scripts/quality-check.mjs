/* ═══════════════════════════════════════════════════════════════
 *  quality-check.mjs  –  Static analysis & code quality
 * ═══════════════════════════════════════════════════════════════ */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const issues = [];

function check(cond, msg) { if (!cond) issues.push(msg); }

// ── Collect source files ──
const jsFiles = readdirSync(ROOT)
  .filter(f => f.endsWith('.js'))
  .map(f => ({ name: f, content: readFileSync(join(ROOT, f), 'utf8') }));

for (const { name, content } of jsFiles) {
  // No console.log in production code (console.error in catch blocks is allowed)
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/console\.(log|warn|error)/.test(line) && !/\/\//.test(line.split('console')[0])) {
      // Allow console.error inside catch blocks (error boundary logging)
      const isCatchError = /console\.error/.test(line) && lines.slice(Math.max(0, i - 5), i).some(l => /\bcatch\b/.test(l));
      if (!isCatchError) {
        check(false, `${name}:${i + 1} – console statement in production code`);
      }
    }
  }

  // IIFE pattern check (except script.js which uses anonymous IIFE, sw.js is a Service Worker)
  if (name !== 'script.js' && name !== 'sw.js') {
    check(
      content.includes('(function') || content.includes('Object.freeze'),
      `${name} – should use IIFE or Object.freeze pattern`
    );
  }

  // 'use strict' check
  check(content.includes("'use strict'"), `${name} – missing 'use strict'`);

  // No var leaks (check for undeclared assignments)
  // Simple heuristic: no global assignments outside IIFE
}

// ── Check HTML ──
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
check(html.includes('face-config.js'), 'index.html loads face-config.js');
check(html.includes('face-i18n.js'), 'index.html loads face-i18n.js');
check(html.includes('face-helpers.js'), 'index.html loads face-helpers.js');
check(html.includes('face-au-detector.js'), 'index.html loads face-au-detector.js');
check(html.includes('face-expression-analyzer.js'), 'index.html loads face-expression-analyzer.js');
check(html.includes('face-psychology-engine.js'), 'index.html loads face-psychology-engine.js');
check(html.includes('face-detector.js'), 'index.html loads face-detector.js');
check(html.includes('face-export.js'), 'index.html loads face-export.js');
check(html.includes('face-history.js'), 'index.html loads face-history.js');
check(html.includes('script.js'), 'index.html loads script.js');
check(html.includes('authenticity'), 'index.html has authenticity section');
check(html.includes('transitionLog'), 'index.html has transition log');
check(html.includes('head-pose'), 'index.html has head pose section');

// ── Check CSS ──
const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
check(css.includes('.authenticity-panel'), 'CSS has authenticity panel styles');
check(css.includes('.transition-panel'), 'CSS has transition panel styles');
check(css.includes('.head-pose-panel'), 'CSS has head pose styles');

// ── Summary ──
console.log('\n═══ Quality Check ═══');
if (issues.length === 0) {
  console.log('  ✓ 0 issues found');
} else {
  console.log(`  ✗ ${issues.length} issue(s):`);
  issues.forEach(i => console.log('    - ' + i));
}
console.log('═════════════════════\n');
process.exit(issues.length > 0 ? 1 : 0);
