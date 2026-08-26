import { IResultSheet } from '../models/result-sheet.model';
import {
  SHEET_COLUMNS,
  entryFootnote,
  formatSheetDate,
  hasFootnotes,
} from './result-sheet-columns';

/**
 * Builds FUTO's Official Grade Report as a pdfmake document.
 *
 * pdfmake rather than CSS print: this is a class list that runs past one page,
 * and it needs a header row that repeats, rows that never split across a break,
 * and a footer that stays put. Paged CSS fights all three.
 *
 * The return type is structural rather than pdfmake's own: the library loads
 * lazily, so its types must not be pulled into the eager bundle.
 */
export interface ResultSheetDocument {
  content: unknown[];
  [key: string]: unknown;
}

export function buildResultSheetPdf(sheet: IResultSheet): ResultSheetDocument {
  const body = [
    SHEET_COLUMNS.map((column) => ({
      text: column.header,
      style: 'th',
      alignment: column.align,
    })),
    ...sheet.entries.map((entry) =>
      SHEET_COLUMNS.map((column) => ({
        text: column.value(entry),
        style: entry.voided ? 'tdMuted' : 'td',
        alignment: column.align,
      }))
    ),
  ];

  return {
    pageSize: 'A4',
    pageMargins: [28, 28, 28, 40],
    defaultStyle: { font: 'Roboto', fontSize: 8 },

    header: (currentPage: number) =>
      currentPage === 1 ? undefined : { text: '', margin: [0, 10] },

    // Page numbers only once the sheet actually runs to several pages —
    // "Page 1 of 1" on a single-page report is noise.
    footer: (currentPage: number, pageCount: number) =>
      pageCount > 1
        ? {
            text: `Page ${currentPage} of ${pageCount}`,
            alignment: 'center',
            fontSize: 7,
            color: '#666666',
            margin: [0, 8, 0, 0],
          }
        : undefined,

    content: [
      { text: sheet.institution.toUpperCase(), style: 'institution' },
      { text: 'OFFICIAL GRADE REPORT', style: 'documentTitle' },

      // The form's two-column meta block, left and right as printed.
      {
        columns: [
          {
            width: '58%',
            stack: [
              metaLine('School of Student', sheet.studentSchool.code),
              metaLine('Department', sheet.department.name.toUpperCase()),
              metaLine('Title of Course', sheet.course.title.toUpperCase()),
              metaLine('School Offering Course', sheet.offeringSchool.code),
            ],
          },
          {
            width: '42%',
            stack: [
              metaLine('Semester', sheet.semesterLabel),
              metaLine('Session', sheet.session),
              metaLine(
                'Course Code',
                `${sheet.course.code}${
                  sheet.course.unitLoad !== null
                    ? `          Units: ${sheet.course.unitLoad}`
                    : ''
                }`
              ),
              metaLine(
                'Date',
                formatSheetDate(sheet.publishedAt ?? sheet.generatedAt)
              ),
            ],
          },
        ],
        margin: [0, 10, 0, 8],
      },

      ...(sheet.partial
        ? [
            {
              text:
                'PARTIAL LIST — this copy shows only the students in your ' +
                'care, not the whole class.',
              style: 'partialWarning',
            },
          ]
        : []),

      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: SHEET_COLUMNS.map((column) => column.width),
          body,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#000000',
          vLineColor: () => '#000000',
          paddingTop: () => 2.5,
          paddingBottom: () => 2.5,
        },
      },

      ...(hasFootnotes(sheet) ? [footnotes(sheet)] : []),

      // Kept together so a signature block never lands alone on a last page.
      {
        unbreakable: true,
        stack: [
          signatureBlock(sheet),
          {
            columns: [
              { width: '40%', stack: [gradeTally(sheet)] },
              { width: '60%', stack: [gradingLegend(sheet)] },
            ],
            margin: [0, 14, 0, 0],
          },
          {
            text:
              `Generated from Acheva on ${formatSheetDate(sheet.generatedAt)}. ` +
              `Approvals shown above are recorded electronically.`,
            style: 'provenance',
          },
        ],
      },
    ],

    styles: {
      institution: { fontSize: 13, bold: true, alignment: 'center' },
      documentTitle: {
        fontSize: 10,
        bold: true,
        alignment: 'center',
        margin: [0, 2, 0, 0],
      },
      metaLabel: { fontSize: 8, color: '#333333' },
      th: { fontSize: 7.5, bold: true },
      td: { fontSize: 7.5 },
      tdMuted: { fontSize: 7.5, color: '#888888', decoration: 'lineThrough' },
      partialWarning: {
        fontSize: 8,
        bold: true,
        color: '#8a5b00',
        margin: [0, 0, 0, 6],
      },
      signatureName: { fontSize: 7.5, bold: true },
      signatureMeta: { fontSize: 6.5, color: '#555555' },
      sectionLabel: { fontSize: 8, bold: true },
      provenance: {
        fontSize: 6.5,
        color: '#777777',
        alignment: 'center',
        margin: [0, 12, 0, 0],
      },
    },
  };
}

function metaLine(label: string, value: string): Record<string, unknown> {
  return {
    text: [
      { text: `${label}: `, style: 'metaLabel' },
      { text: value || '—', bold: true },
    ],
    margin: [0, 1.5],
  };
}

/**
 * The form's three signature lines. Acheva cannot reproduce a handwritten
 * signature, so each line carries the approver's name and the date they signed
 * — which is more than the paper form proves, since the signatures on it are
 * unreadable.
 */
function signatureBlock(sheet: IResultSheet): Record<string, unknown> {
  const latest = (role: string) =>
    [...sheet.approvals].reverse().find((a) => a.role === role) ?? null;

  const hod = latest('HOD');
  const dean = latest('DEAN');
  const examiner =
    latest('COURSE_COORDINATOR') ??
    (sheet.courseCoordinator
      ? { name: sheet.courseCoordinator.name, date: '', action: '' }
      : null);

  const line = (title: string, who: { name: string; date: string } | null) => ({
    width: '33%',
    stack: [
      { text: who?.name?.toUpperCase() ?? '', style: 'signatureName' },
      {
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 },
        ],
        margin: [0, 2, 0, 2],
      },
      { text: title, fontSize: 7.5 },
      {
        text: who?.date
          ? `Approved ${formatSheetDate(who.date)}`
          : 'Not yet approved',
        style: 'signatureMeta',
      },
    ],
  });

  return {
    columns: [
      line('Head of Department', hod),
      line('Dean of School', dean),
      line('Examiner(s)', examiner),
    ],
    margin: [0, 22, 0, 0],
  };
}

/** The A = 0, B = 2 … tally printed at the foot of the form. */
function gradeTally(sheet: IResultSheet): Record<string, unknown> {
  return {
    stack: Object.entries(sheet.summary.distribution).map(([grade, count]) => ({
      text: `${grade} = ${count}`,
      fontSize: 8,
      margin: [0, 0.5],
    })),
  };
}

function gradingLegend(sheet: IResultSheet): Record<string, unknown> {
  const band = (b: { grade: string; min: number; max: number }) =>
    b.max >= 100
      ? `${b.min}% and Above: ${b.grade}`
      : b.min === 0
        ? `Below ${b.max + 1}%: ${b.grade}`
        : `${b.min}% - ${b.max}%: ${b.grade}`;

  const bands = sheet.gradingScale.map(band);
  const half = Math.ceil(bands.length / 2);

  return {
    stack: [
      { text: 'Grading System:', style: 'sectionLabel', margin: [0, 0, 0, 3] },
      {
        columns: [
          {
            stack: bands
              .slice(0, half)
              .map((t) => ({ text: t, fontSize: 8, margin: [0, 0.5] })),
          },
          {
            stack: bands
              .slice(half)
              .map((t) => ({ text: t, fontSize: 8, margin: [0, 0.5] })),
          },
        ],
      },
    ],
  };
}

function footnotes(sheet: IResultSheet): Record<string, unknown> {
  const notes = sheet.entries
    .map((entry) => ({ entry, note: entryFootnote(entry) }))
    .filter((row) => row.note !== null);

  return {
    margin: [0, 6, 0, 0],
    stack: [
      { text: 'Notes', style: 'sectionLabel' },
      ...notes.map((row) => ({
        text: `${row.entry.serial}. ${row.entry.registrationNumber} — ${row.note}`,
        fontSize: 7,
        color: '#555555',
        margin: [0, 0.5],
      })),
    ],
  };
}
