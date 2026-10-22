#!/usr/bin/env node
/**
 * Static audit of every interactive control in an Angular app.
 *
 * Finds three kinds of dead control that a browser sweep cannot reach,
 * because reaching them needs a document in a particular state:
 *
 *   1. A handler bound in the template that the component does not define.
 *      Angular fails these SILENTLY at runtime — the click does nothing and
 *      nothing is logged.
 *   2. A <button> with no binding of any kind and no routerLink: either dead
 *      or a submit button in a form.
 *   3. A (click) on a non-interactive element — unreachable by keyboard.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const root = process.argv[2];
if (!root) {
  console.error('usage: static-audit.mjs <src dir>');
  process.exit(2);
}

const htmlFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') continue;
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith('.html')) htmlFiles.push(full);
  }
})(root);

/** Event bindings: (click)="foo(...)", (change)="bar($event)" etc. */
const BINDING = /\((\w[\w.-]*)\)\s*=\s*"([^"]*)"/g;
/** Property bindings that name a member: [disabled]="saving()" */
const PROP = /\[([\w.-]+)\]\s*=\s*"([^"]*)"/g;

/**
 * ROOT identifiers only — the thing the component must own.
 *
 * `a.b()` is the component owning `a`; whether `a` has a `b` is TypeScript's
 * job, not this script's. Matching `b` too reported every
 * `$event.stopPropagation()` and `selection.toggle()` as a missing handler,
 * which buries the real findings in noise.
 */
function membersIn(expression) {
  const names = new Set();
  for (const m of expression.matchAll(/(^|[^.\w$])([a-zA-Z_$][\w$]*)/g)) {
    names.add(m[2]);
  }
  return names;
}

/** Things that are template syntax or globals, not component members. */
const NOT_MEMBERS = new Set([
  '$event', '$any', '$index', '$first', '$last', '$even', '$odd', '$count',
  'new', 'return', 'void', 'typeof', 'in', 'instanceof', 'delete',
  'true', 'false', 'null', 'undefined', 'this', 'item', 'row', 'element',
  'console', 'window', 'document', 'Math', 'Number', 'String', 'Object',
  'Array', 'JSON', 'Boolean', 'Date', 'let', 'of', 'as', 'track', 'if',
  'else', 'for', 'switch', 'case', 'default', 'empty', 'at', 'placeholder',
]);

const INTERACTIVE = /^(button|a|input|select|textarea|mat-|app-|acva-)/i;

const findings = { missingHandler: [], unboundButton: [], clickOnDiv: [] };
let controls = 0;

for (const html of htmlFiles) {
  /**
   * Comments stripped first. A commented-out block is dead code, not a dead
   * button — reporting it as a missing handler buries the live findings.
   */
  const src = readFileSync(html, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const base = html.replace(/\.html$/, '');
  let ts = '';
  for (const candidate of [`${base}.ts`, `${base}.component.ts`]) {
    try { ts = readFileSync(candidate, 'utf8'); break; } catch { /* next */ }
  }
  // Inline-template or shared template — cannot resolve members, skip member checks.
  const haveTs = ts.length > 0;

  // Template-local names: @for (x of ...) / #ref / @let
  const locals = new Set();
  for (const m of src.matchAll(/@for\s*\(\s*(\w+)\s+of/g)) locals.add(m[1]);
  for (const m of src.matchAll(/@if\s*\([^)]*;\s*as\s+(\w+)/g)) locals.add(m[1]);
  for (const m of src.matchAll(/#(\w+)/g)) locals.add(m[1]);
  for (const m of src.matchAll(/@let\s+(\w+)/g)) locals.add(m[1]);
  for (const m of src.matchAll(/let-(\w+)/g)) locals.add(m[1]);
  // *matCellDef="let row" / *ngFor="let x of"
  for (const m of src.matchAll(/let\s+(\w+)/g)) locals.add(m[1]);

  for (const [, event, expr] of src.matchAll(BINDING)) {
    if (event.startsWith('@')) continue;
    controls++;
    if (!haveTs) continue;
    for (const name of membersIn(expr)) {
      if (NOT_MEMBERS.has(name) || locals.has(name)) continue;
      // Defined as a method, property, signal, getter or inherited?
      const defined =
        new RegExp(`\\b${name}\\s*[(:=]`).test(ts) ||
        new RegExp(`\\b(get|set|async)\\s+${name}\\b`).test(ts) ||
        new RegExp(`\\b${name}\\b`).test(ts);
      if (!defined) {
        findings.missingHandler.push(`${html}  (${event})="${expr.slice(0, 60)}"  → ${name}`);
      }
    }
  }

  // <button> with nothing bound
  for (const m of src.matchAll(/<button\b([^>]*)>/g)) {
    const attrs = m[1];
    controls++;
    const hasBinding = /\(\w+\)\s*=|routerLink|type\s*=\s*"submit"|mat-dialog-close|matMenuTriggerFor|cdkMenuTriggerFor/.test(attrs);
    if (!hasBinding) {
      findings.unboundButton.push(`${html}  <button${attrs.slice(0, 80).replace(/\s+/g, ' ')}>`);
    }
  }

  // (click) on something that is not focusable
  for (const m of src.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*\(click\)[^>]*)>/g)) {
    const [, tag, attrs] = m;
    if (INTERACTIVE.test(tag)) continue;
    if (/tabindex|role\s*=\s*"(button|tab|link|menuitem|option)"/.test(attrs)) continue;
    findings.clickOnDiv.push(`${html}  <${tag} …(click)…>`);
  }
}

const label = basename(dirname(root)) || root;
console.log(`\n═══ ${label} — ${htmlFiles.length} templates, ${controls} controls ═══`);

const report = (title, rows, note) => {
  console.log(`\n${title}: ${rows.length}`);
  if (note && rows.length) console.log(`  ${note}`);
  for (const row of rows.slice(0, 40)) console.log(`  • ${row.replace(root, '…')}`);
  if (rows.length > 40) console.log(`  … and ${rows.length - 40} more`);
};

report('HANDLER NOT FOUND ON COMPONENT (silent dead click)', findings.missingHandler);
report('BUTTON WITH NO BINDING', findings.unboundButton, 'submit buttons inside a form are fine');
report('(click) ON A NON-FOCUSABLE ELEMENT (keyboard cannot reach)', findings.clickOnDiv);
