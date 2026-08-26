import { IResultSheet, IResultSheetEntry } from '../models/result-sheet.model';

/**
 * The table on FUTO's Official Grade Report, defined once.
 *
 * The PDF and the spreadsheet both build from this list, in this order, so the
 * two exports cannot drift apart — a column added for one is a column added
 * for both. `*LAB` keeps the asterisk the paper form prints.
 */
export interface SheetColumn {
  readonly header: string;
  readonly value: (entry: IResultSheetEntry) => string;
  /** Relative width for the PDF; the spreadsheet uses it as a character width. */
  readonly width: number;
  readonly align: 'left' | 'center';
}

/** Blank rather than 0 — the paper form leaves an unscored cell empty. */
const score = (value: number | null): string =>
  value === null || value === undefined ? '' : String(value);

export const SHEET_COLUMNS: readonly SheetColumn[] = [
  { header: 'SN', value: (e) => String(e.serial), width: 18, align: 'center' },
  {
    header: 'NAMES',
    value: (e) => e.fullName.toUpperCase(),
    width: 150,
    align: 'left',
  },
  {
    header: 'REG. NO.',
    value: (e) => e.registrationNumber,
    width: 70,
    align: 'left',
  },
  { header: 'PROGRAM', value: (e) => e.programme, width: 45, align: 'center' },
  { header: 'TEST', value: (e) => score(e.test), width: 30, align: 'center' },
  { header: '*LAB', value: (e) => score(e.lab), width: 30, align: 'center' },
  { header: 'EXAM', value: (e) => score(e.exam), width: 32, align: 'center' },
  { header: 'TOTAL', value: (e) => score(e.total), width: 34, align: 'center' },
  { header: 'GRADE', value: (e) => e.grade ?? '', width: 34, align: 'center' },
  {
    header: 'REMARK',
    value: (e) => e.status ?? '',
    width: 42,
    align: 'center',
  },
];

/**
 * A row's footnotes. The paper form has no column for these, but a moderated
 * or set-aside score must not print as though it were an ordinary one.
 */
export function entryFootnote(entry: IResultSheetEntry): string | null {
  if (entry.voided) return 'Set aside — does not count toward GPA';
  if (entry.moderated) return 'Moderated';
  if (entry.awaitingRegistrationDecision)
    return 'Awaiting registration decision';
  return null;
}

export function hasFootnotes(sheet: IResultSheet): boolean {
  return sheet.entries.some((entry) => entryFootnote(entry) !== null);
}

/** dd/mm/yyyy — the format the form's Date field uses. */
export function formatSheetDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** The filename both exports share, differing only in extension. */
export function sheetFileName(sheet: IResultSheet): string {
  const session = sheet.session.replace('/', '-');
  return [sheet.course.code.replace(/\s+/g, ''), session, sheet.semesterLabel]
    .filter(Boolean)
    .join('_');
}
