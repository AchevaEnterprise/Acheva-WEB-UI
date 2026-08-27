import type { WorkBook, WorkSheet } from 'xlsx';
import { IResultSheet } from '../models/result-sheet.model';
import {
  SHEET_COLUMNS,
  entryFootnote,
  formatSheetDate,
} from './result-sheet-columns';

/**
 * The same Official Grade Report as a spreadsheet.
 *
 * Built as an array-of-arrays rather than from JSON keys so the header block,
 * the table, the tally and the signature lines land in the SAME order the PDF
 * prints them — a lecturer who opens both should recognise one document, not
 * two. Column headers come from `SHEET_COLUMNS`, so neither export can gain a
 * column the other lacks.
 */
export function buildResultSheetRows(sheet: IResultSheet): unknown[][] {
  const blank: unknown[] = [];

  const rows: unknown[][] = [
    [sheet.institution.toUpperCase()],
    ['OFFICIAL GRADE REPORT'],
    blank,
    [
      'School of Student:',
      sheet.studentSchool.code,
      '',
      'Semester:',
      sheet.semesterLabel,
    ],
    [
      'Department:',
      sheet.department.name.toUpperCase(),
      '',
      'Session:',
      sheet.session,
    ],
    [
      'Title of Course:',
      sheet.course.title.toUpperCase(),
      '',
      'Course Code:',
      sheet.course.code,
      'Units:',
      sheet.course.unitLoad ?? '',
    ],
    [
      'School Offering Course:',
      sheet.offeringSchool.code,
      '',
      'Date:',
      formatSheetDate(sheet.publishedAt ?? sheet.generatedAt),
    ],
    blank,
  ];

  if (sheet.partial) {
    rows.push([
      'PARTIAL LIST — this copy shows only the students in your care, not the whole class.',
    ]);
    rows.push(blank);
  }

  rows.push(SHEET_COLUMNS.map((column) => column.header));

  for (const entry of sheet.entries) {
    rows.push(
      SHEET_COLUMNS.map((column) => {
        const text = column.value(entry);
        // Scores go in as numbers so the spreadsheet can total and sort them;
        // everything else stays text (a registration number is not a quantity,
        // and Excel would mangle it into scientific notation).
        return column.align === 'center' &&
          /^\d+$/.test(text) &&
          column.header !== 'SN'
          ? Number(text)
          : text;
      })
    );
  }

  const notes = sheet.entries
    .map((entry) => ({ entry, note: entryFootnote(entry) }))
    .filter((row) => row.note !== null);

  if (notes.length > 0) {
    rows.push(blank, ['Notes']);
    for (const { entry, note } of notes) {
      rows.push([`${entry.serial}. ${entry.registrationNumber} — ${note}`]);
    }
  }

  rows.push(blank);
  for (const [grade, count] of Object.entries(sheet.summary.distribution)) {
    rows.push([`${grade} = ${count}`]);
  }

  // The same analysis the PDF prints under the tally, and the same the app
  // shows on screen. Numbers stay numeric so the sheet can be charted.
  rows.push(blank, ['Analysis']);
  rows.push(['Total', sheet.summary.total]);
  rows.push(['Passed', sheet.summary.totalPass]);
  rows.push(['Failed', sheet.summary.totalFail]);
  rows.push(['Average', sheet.summary.averageTotal]);
  rows.push(['Pass rate (%)', sheet.summary.percentagePass]);
  rows.push(['Fail rate (%)', sheet.summary.percentageFail]);

  rows.push(blank, ['Grading System:']);
  for (const band of sheet.gradingScale) {
    rows.push([
      band.max >= 100
        ? `${band.min}% and Above: ${band.grade}`
        : band.min === 0
          ? `Below ${band.max + 1}%: ${band.grade}`
          : `${band.min}% - ${band.max}%: ${band.grade}`,
    ]);
  }

  rows.push(blank, ['Approvals']);
  if (sheet.approvals.length === 0) {
    rows.push(['None recorded']);
  }
  for (const approval of sheet.approvals) {
    rows.push([
      approval.role,
      approval.name,
      approval.action,
      formatSheetDate(approval.date),
      approval.comment ?? '',
    ]);
  }

  rows.push(blank, [
    `Generated from Acheva on ${formatSheetDate(sheet.generatedAt)}. ` +
      `Approvals shown above are recorded electronically.`,
  ]);

  return rows;
}

/** Column widths so the sheet is readable without the user resizing anything. */
export function applySheetColumnWidths(worksheet: WorkSheet): void {
  (worksheet as WorkSheet & { '!cols'?: unknown[] })['!cols'] =
    SHEET_COLUMNS.map((column) => ({
      wch: Math.max(6, Math.round(column.width / 5)),
    }));
}

export function sheetName(sheet: IResultSheet): string {
  // Excel caps sheet names at 31 chars and forbids : \ / ? * [ ]
  return `${sheet.course.code} ${sheet.semesterLabel}`
    .replace(/[:\\/?*[\]]/g, '')
    .slice(0, 31);
}

export type { WorkBook };
