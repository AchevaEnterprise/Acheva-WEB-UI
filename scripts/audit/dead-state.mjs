#!/usr/bin/env node
/**
 * State that is written and never read.
 *
 * A signal the component `.set()`s but nothing ever reads is a control whose
 * value goes nowhere: the search box accepts text, the handler fires, the
 * signal updates, and the list never changes. Nothing errors, so it looks
 * exactly like a working filter.
 *
 * Reads counted in BOTH the component and its template — a signal is very
 * often only read from the HTML.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

const root = process.argv[2];
const tsFiles = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (e === 'node_modules' || e === 'dist') continue;
    if (statSync(full).isDirectory()) walk(full);
    else if (e.endsWith('.ts') && !e.endsWith('.spec.ts')) tsFiles.push(full);
  }
})(root);

/** Every file's text, for the cross-file read check below. */
const corpus = [];
(function collect(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (e === 'node_modules' || e === 'dist') continue;
    if (statSync(full).isDirectory()) collect(full);
    else if (e.endsWith('.ts') || e.endsWith('.html')) corpus.push(readFileSync(full, 'utf8'));
  }
})(root);

const dead = [];
let total = 0;

for (const file of tsFiles) {
  const ts = readFileSync(file, 'utf8');
  const base = file.replace(/\.ts$/, '');
  let html = '';
  for (const c of [`${base}.html`, `${base.replace(/\.component$/, '')}.html`]) {
    if (existsSync(c)) { html = readFileSync(c, 'utf8'); break; }
  }
  // Inline templates live in the .ts itself.
  const scope = ts + '\n' + html;

  for (const m of ts.matchAll(/^\s*(?:readonly\s+)?(\w+)\s*=\s*signal\s*[<(]/gm)) {
    const name = m[1];
    total++;

    const written = new RegExp(`\\b${name}\\.(set|update)\\s*\\(`).test(ts);
    if (!written) continue;

    // A read is `name()` anywhere outside its own declaration, or the signal
    // being handed somewhere whole (`[x]="name"`, `name,` in an object).
    const reads = [...scope.matchAll(new RegExp(`\\b${name}\\s*\\(\\s*\\)`, 'g'))].length;
    const passed = new RegExp(`[\\[(]\\s*[\\w.-]+\\s*\\]?\\s*=\\s*"[^"]*\\b${name}\\b[^"(]*"`).test(html);

    /**
     * A signal declared on a SERVICE is read through the injected instance
     * elsewhere (`sync.pendingCount()`), so the declaring file and its own
     * template are not the whole story. Sweep every file for the property
     * form before calling it dead.
     */
    const elsewhere =
      reads === 0 &&
      !passed &&
      corpus.some((text) => new RegExp(`\\.${name}\\s*\\(\\s*\\)`).test(text));

    if (reads === 0 && !passed && !elsewhere) {
      const line = ts.slice(0, m.index).split('\n').length;
      dead.push(`${file.replace(root, '…')}:${line}  ${name}`);
    }
  }
}

console.log(`\n═══ ${basename(dirname(root))} — ${total} signals ═══`);
console.log(`WRITTEN BUT NEVER READ: ${dead.length}`);
for (const d of dead) console.log(`  • ${d}`);
