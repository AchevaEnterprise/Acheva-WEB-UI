#!/usr/bin/env node
/**
 * Dropdowns that do not filter anything.
 *
 * A <select> or <mat-select> with no `(change)`, `(selectionChange)`,
 * `formControlName`, `[(ngModel)]` or two-way binding cannot tell anyone it
 * was used. It looks like a working control, the options change on screen,
 * and the list behind it never moves — the most convincing kind of broken,
 * because nothing errors.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

const root = process.argv[2];
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (e === 'node_modules' || e === 'dist') continue;
    if (statSync(full).isDirectory()) walk(full);
    else if (e.endsWith('.html')) files.push(full);
  }
})(root);

const BOUND =
  /\(change\)|\(selectionChange\)|\(valueChange\)|formControlName|formControl|\[\(ngModel\)\]|\[\(value\)\]|\(ngModelChange\)|\(input\)|\(opened\)|\(closed\)/;

const dead = [];
let total = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');

  for (const tag of ['select', 'mat-select']) {
    const re = new RegExp(`<${tag}\\b([\\s\\S]*?)>`, 'g');
    for (const m of src.matchAll(re)) {
      total++;
      if (BOUND.test(m[1])) continue;
      const label =
        (m[1].match(/placeholder\s*=\s*"([^"]*)"/) ??
          m[1].match(/aria-label\s*=\s*"([^"]*)"/) ??
          [])[1] ?? '(no label)';
      const line = src.slice(0, m.index).split('\n').length;
      dead.push(`${file.replace(root, '…')}:${line}  <${tag}> "${label}"`);
    }
  }
}

console.log(`\n═══ ${basename(dirname(root))} — ${total} dropdowns ═══`);
console.log(`DROPDOWNS THAT CANNOT REPORT A CHANGE: ${dead.length}`);
for (const d of dead) console.log(`  • ${d}`);
