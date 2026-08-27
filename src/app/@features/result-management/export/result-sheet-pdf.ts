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
          approvalStamps(sheet),
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
      stampHeading: {
        fontSize: 9,
        bold: true,
        color: '#000000',
      },
      stampHeadingPending: {
        fontSize: 8,
        bold: true,
        color: '#888888',
      },
      stampRole: { fontSize: 7.5, bold: true },
      stampDate: {
        fontSize: 6.5,
        color: '#555555',
        margin: [0, 1, 0, 0],
      },
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
 * The form's three sign-off positions, as approval marks over a signature rule.
 *
 * Acheva cannot reproduce a handwritten signature and should not pretend to.
 * "APPROVED" sits where the scrawl would go, above the same ruled line the
 * paper form uses, with the office and the date beneath it.
 *
 * NO NAMES. Heads and Deans change often, and a name printed here would be
 * stale the moment the post turns over — the office is what holds the
 * authority, not the person occupying it this year.
 *
 * The office is named to its unit ("HOD MTH", "Dean of SOPS") rather than left
 * generic, so a sheet that crosses departments says exactly whose approval it
 * carries.
 *
 * A position nobody has approved yet still prints its rule, so an incomplete
 * sheet is visibly incomplete rather than quietly missing a mark.
 */
function approvalStamps(sheet: IResultSheet): Record<string, unknown> {
  const latest = (role: string) =>
    [...sheet.approvals].reverse().find((a) => a.role === role) ?? null;

  const unit = (org: { name: string; code: string }) =>
    org.code || org.name || '—';

  const stamp = (title: string, who: { date: string } | null) => {
    const approved = Boolean(who?.date);

    return {
      width: '33%',
      margin: [0, 0, 10, 0],
      stack: [
        {
          text: approved ? 'APPROVED' : 'AWAITING APPROVAL',
          style: approved ? 'stampHeading' : 'stampHeadingPending',
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 150,
              y2: 0,
              lineWidth: 0.7,
              lineColor: '#000000',
            },
          ],
          margin: [0, 2, 0, 3],
        },
        { text: title, style: 'stampRole' },
        {
          text: approved ? formatSheetDate(who!.date) : 'Not yet approved',
          style: 'stampDate',
        },
      ],
    };
  };

  return {
    columns: [
      // The last HOD approval on an external cohort is the offering
      // department's Head, which is the department this sheet is for.
      stamp(`HOD ${unit(sheet.department)}`, latest('HOD')),
      // Acheva records the Dean of the cohort's faculty — the student's school.
      stamp(`Dean of ${unit(sheet.studentSchool)}`, latest('DEAN')),
      // The Examiner position is held by the Course Coordinator.
      stamp('Examiner(s)', latest('COURSE_COORDINATOR')),
    ],
    margin: [0, 20, 0, 0],
  };
}

/**
 * The A = 0, B = 2 … tally the form prints, followed by the same analysis the
 * app shows on screen. The paper form stops at the tally, which leaves whoever
 * reads it to work out the pass rate by hand from a list of forty names.
 */
function gradeTally(sheet: IResultSheet): Record<string, unknown> {
  const { summary } = sheet;

  const stat = (label: string, value: string, emphasis = false) => ({
    columns: [
      { text: label, fontSize: 8, width: 62 },
      { text: value, fontSize: 8, bold: emphasis },
    ],
    margin: [0, 0.5],
  });

  return {
    stack: [
      ...Object.entries(summary.distribution).map(([grade, count]) => ({
        text: `${grade} = ${count}`,
        fontSize: 8,
        margin: [0, 0.5],
      })),
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 120,
            y2: 0,
            lineWidth: 0.5,
            lineColor: '#999999',
          },
        ],
        margin: [0, 5, 0, 4],
      },
      stat('Total', String(summary.total)),
      stat('Passed', String(summary.totalPass)),
      stat('Failed', String(summary.totalFail)),
      stat('Average', `${summary.averageTotal}%`),
      stat('Pass rate', `${summary.percentagePass}%`, true),
      stat('Fail rate', `${summary.percentageFail}%`, true),
    ],
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
