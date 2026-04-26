/// <reference lib="webworker" />

import * as XLSX from 'xlsx';

// --------------------- UTILITIES ---------------------

function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join('');
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || s === 'null' || s === 'undefined';
}

function extractTable<T>(rows: unknown[][]) {
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => String(cell).trim().toLowerCase() === 'sn')
  );

  if (headerIndex === -1) throw new Error('No header found');

  const headerRow = rows[headerIndex].map((c) => String(c).trim());
  const camelColumns = headerRow.map((col) => toCamelCase(col));

  const dataRows = rows.slice(headerIndex + 1);
  const records: T[] = [];

  for (const row of dataRows) {
    const sn = row[0];
    const isNumericSN = typeof sn === 'number' || /^\d+$/.test(String(sn));
    if (!isNumericSN) continue;

    const obj: Record<string, unknown> = {};
    camelColumns.forEach((key, idx) => {
      obj[key] = row[idx] ?? null;
    });

    records.push(obj as T);
  }

  const filtered = records.filter((rec) => {
    const obj = rec as Record<string, unknown>;
    const ignore = new Set(['sn']);
    return Object.entries(obj).some(([key, value]) => {
      if (ignore.has(key.toLowerCase())) return false;
      return !isEmptyValue(value);
    });
  });

  return { columns: camelColumns, records: filtered };
}

// --------------------- WORKER MESSAGE HANDLER ---------------------
addEventListener('message', async ({ data }) => {
  try {
    const binary = data.binary as string;
    const workbook = XLSX.read(binary, { type: 'binary' });

    let finalColumns: string[] = [];
    const finalRecords: any[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: '',
      }) as string[][];

      try {
        const { columns, records } = extractTable(rows);

        if (finalColumns.length === 0) {
          finalColumns = columns;
        }

        finalRecords.push(...records);
      } catch {
        continue; // skip sheets without valid headers
      }
    }

    postMessage({ columns: finalColumns, records: finalRecords });
  } catch (err) {
    postMessage({ error: (err as Error).message });
  }
});
