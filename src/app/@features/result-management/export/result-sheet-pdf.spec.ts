import { IResultSheet } from '../models/result-sheet.model';
import { buildResultSheetPdf } from './result-sheet-pdf';
import { buildResultSheetRows } from './result-sheet-excel';
import { SHEET_COLUMNS, formatSheetDate } from './result-sheet-columns';

/**
 * Locks the shape of FUTO's Official Grade Report. The layout is copied from a
 * photo of the real form, so a change here means the printed sheet stops
 * matching the paper one departments already use.
 */

const sheet = (over: Partial<IResultSheet> = {}): IResultSheet => ({
  course: { code: 'GET 102', title: 'Engineering Graphics', unitLoad: 2, assessmentShape: 'THEORY' },
  institution: 'Federal University of Technology, Owerri',
  studentSchool: { name: 'School of Physical Sciences', code: 'SOPS' },
  offeringSchool: { name: 'School of Engineering', code: 'SEET' },
  department: { name: 'Mathematics', code: 'MTH' },
  session: '2024/2025',
  semester: '2ND SEMESTER',
  semesterLabel: 'RAIN',
  level: '100',
  status: 'PUBLISHED',
  publishedAt: '2025-12-18T10:00:00.000Z',
  lecturer: { name: 'Dr A Lecturer', role: 'LECTURER' },
  courseCoordinator: { name: 'Dr Nnamdi Araka', role: 'COURSE_COORDINATOR' },
  entries: [
    {
      serial: 1, registrationNumber: '20241436385', fullName: 'agbata possible',
      programme: 'MTH', test: 10, lab: 14, exam: 32, total: 56, grade: 'C',
      status: 'PASS', units: 2, category: 'REGULAR', moderated: false,
      voided: false, awaitingRegistrationDecision: false,
    },
    {
      serial: 2, registrationNumber: '20241483975', fullName: 'amaechi georgina',
      programme: 'MTH', test: 10, lab: null, exam: 23, total: 33, grade: 'F',
      status: 'FAIL', units: 2, category: 'REGULAR', moderated: false,
      voided: false, awaitingRegistrationDecision: false,
    },
  ],
  summary: {
    total: 2, totalPass: 1, totalFail: 1, averageTotal: 44.5,
    percentagePass: 50, percentageFail: 50,
    distribution: { A: 0, B: 0, C: 1, D: 0, E: 0, F: 1 },
  },
  approvals: [
    { action: 'APPROVED', name: 'Dr Nnamdi Araka', role: 'COURSE_COORDINATOR', date: '2025-12-10T09:00:00.000Z', comment: null },
    { action: 'APPROVED', name: 'Prof H O D', role: 'HOD', date: '2025-12-12T09:00:00.000Z', comment: null },
    { action: 'APPROVED', name: 'Prof D Ean', role: 'DEAN', date: '2025-12-15T09:00:00.000Z', comment: null },
  ],
  gradingScale: [
    { grade: 'A', min: 70, max: 100 }, { grade: 'B', min: 60, max: 69 },
    { grade: 'C', min: 50, max: 59 }, { grade: 'D', min: 45, max: 49 },
    { grade: 'E', min: 40, max: 44 }, { grade: 'F', min: 0, max: 39 },
  ],
  generatedAt: '2026-08-26T12:00:00.000Z',
  partial: false,
  categories: ['REGULAR'],
  ...over,
});

/** Every string in a nested pdfmake definition, flattened. */
function textOf(node: unknown): string[] {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textOf);
  if (typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>)
      .filter(([key]) => key !== 'style' && key !== 'layout')
      .flatMap(([, value]) => textOf(value));
  }
  return [];
}

describe('result sheet PDF — FUTO Official Grade Report', () => {
  it('carries the institution and document title', () => {
    const text = textOf(buildResultSheetPdf(sheet()).content);
    expect(text).toContain('FEDERAL UNIVERSITY OF TECHNOLOGY, OWERRI');
    expect(text).toContain('OFFICIAL GRADE REPORT');
  });

  it('prints both schools — the student\'s and the one offering the course', () => {
    const text = textOf(buildResultSheetPdf(sheet()).content).join(' ');
    expect(text).toContain('School of Student');
    expect(text).toContain('SOPS');
    expect(text).toContain('School Offering Course');
    expect(text).toContain('SEET');
  });

  it('prints the semester by FUTO\'s name, not the stored form', () => {
    const text = textOf(buildResultSheetPdf(sheet()).content).join(' ');
    expect(text).toContain('RAIN');
    expect(text).not.toContain('2ND SEMESTER');
  });

  it('uses the form\'s exact column order', () => {
    const content = buildResultSheetPdf(sheet()).content as Array<{
      table?: { body: Array<Array<{ text: string }>> };
    }>;
    const table = content.find((node) => node.table);
    expect(table?.table?.body[0].map((cell) => cell.text)).toEqual([
      'SN', 'NAMES', 'REG. NO.', 'PROGRAM', 'TEST', '*LAB', 'EXAM', 'TOTAL', 'GRADE', 'REMARK',
    ]);
  });

  it('leaves an unscored cell blank rather than printing 0', () => {
    const content = buildResultSheetPdf(sheet()).content as Array<{
      table?: { body: Array<Array<{ text: string }>> };
    }>;
    const rows = content.find((node) => node.table)!.table!.body;
    // Row 2 has no lab score; *LAB is the sixth column.
    expect(rows[2][5].text).toBe('');
  });

  it('prints no personal names — offices change hands, the office does not', () => {
    const text = textOf(buildResultSheetPdf(sheet()).content).join(' | ');
    expect(text).not.toContain('PROF H O D');
    expect(text).not.toContain('PROF D EAN');
    expect(text).not.toContain('Dr Nnamdi Araka');
    // The date of approval is still there — that is the part that matters.
    expect(text).toContain(formatSheetDate('2025-12-12T09:00:00.000Z'));
  });

  it('names each office to its own unit, never generically', () => {
    const text = textOf(buildResultSheetPdf(sheet()).content).join(' | ');
    expect(text).toContain('HOD MTH');
    expect(text).toContain('Dean of SEET');
    expect(text).not.toContain('Head of Department');
    expect(text).not.toContain('Dean of School');
  });

  it('signs with the Dean of the faculty that OWNS the course', () => {
    // A Maths student sitting ENG 101: the Engineering HOD submits it, so the
    // Engineering Dean signs — not the Dean of the student's own school.
    const crossSchool = sheet({
      department: { name: 'Mathematics', code: 'MTH' },
      studentSchool: { name: 'School of Physical Sciences', code: 'SOPS' },
      offeringSchool: { name: 'School of Engineering', code: 'SEET' },
    });
    const text = textOf(buildResultSheetPdf(crossSchool).content).join(' | ');
    expect(text).toContain('Dean of SEET');
    expect(text).not.toContain('Dean of SOPS');
  });

  it('falls back to the unit name when a code is missing', () => {
    const noCodes = sheet({
      department: { name: 'Mathematics', code: '' },
      studentSchool: { name: 'School of Physical Sciences', code: '' },
      offeringSchool: { name: 'School of Engineering', code: '' },
    });
    const text = textOf(buildResultSheetPdf(noCodes).content).join(' | ');
    expect(text).toContain('HOD Mathematics');
    expect(text).toContain('Dean of School of Engineering');
  });

  it('prints the pass and fail rates under the tally, not just the grades', () => {
    // The paper form stops at the tally, leaving the reader to work the pass
    // rate out by hand from forty names.
    const text = textOf(buildResultSheetPdf(sheet()).content).join(' | ');
    expect(text).toContain('Pass rate');
    expect(text).toContain('50%');
    expect(text).toContain('Fail rate');
    expect(text).toContain('Average');
    // A mark out of 100 is a percentage; print it as one.
    expect(text).toContain('44.5%');
  });

  it('marks each approval instead of faking a signature', () => {
    const text = textOf(buildResultSheetPdf(sheet()).content).join(' | ');
    expect(text).toContain('APPROVED');
    expect(text).toContain('HOD MTH');
    expect(text).toContain('Dean of SEET');
    expect(text).toContain('Examiner(s)');
  });

  it('marks an unapproved position rather than hiding it', () => {
    const noDean = sheet({
      approvals: sheet().approvals.filter((a) => a.role !== 'DEAN'),
    });
    const text = textOf(buildResultSheetPdf(noDean).content).join(' | ');
    expect(text).toContain('AWAITING APPROVAL');
    expect(text).toContain('Not yet approved');
  });

  it('never prints an email address anywhere on the sheet', () => {
    const nameless = sheet({
      approvals: sheet().approvals.map((a) => ({
        ...a,
        name: 'someone@example.com',
      })),
      courseCoordinator: { name: 'someone@example.com', role: 'COURSE_COORDINATOR' },
    });
    const text = textOf(buildResultSheetPdf(nameless).content).join(' | ');
    expect(text).not.toContain('@');
  });

  it('prints the grade tally and the grading legend', () => {
    const text = textOf(buildResultSheetPdf(sheet()).content).join(' | ');
    expect(text).toContain('C = 1');
    expect(text).toContain('F = 1');
    expect(text).toContain('Grading System:');
    expect(text).toContain('70% and Above: A');
    expect(text).toContain('Below 40%: F');
  });

  it('says so on its face when the copy is partial', () => {
    const full = textOf(buildResultSheetPdf(sheet()).content).join(' ');
    expect(full).not.toContain('PARTIAL LIST');

    const partial = textOf(
      buildResultSheetPdf(sheet({ partial: true })).content,
    ).join(' ');
    expect(partial).toContain('PARTIAL LIST');
  });

  it('footnotes a moderated or set-aside row instead of printing it as ordinary', () => {
    const base = sheet();
    const withFlags = sheet({
      entries: [
        { ...base.entries[0], moderated: true },
        { ...base.entries[1], voided: true },
      ],
    });
    const text = textOf(buildResultSheetPdf(withFlags).content).join(' | ');
    expect(text).toContain('Moderated');
    expect(text).toContain('Set aside — does not count toward GPA');
  });
});

describe('result sheet spreadsheet', () => {
  it('uses the same columns, in the same order, as the PDF', () => {
    const rows = buildResultSheetRows(sheet());
    const header = rows.find(
      (row) => Array.isArray(row) && row[0] === 'SN',
    );
    expect(header).toEqual(SHEET_COLUMNS.map((column) => column.header));
  });

  it('writes scores as numbers but keeps registration numbers as text', () => {
    const rows = buildResultSheetRows(sheet());
    const headerIndex = rows.findIndex((row) => row[0] === 'SN');
    const first = rows[headerIndex + 1];
    expect(typeof first[2]).toBe('string'); // REG. NO.
    expect(typeof first[4]).toBe('number'); // TEST
  });

  it('repeats the header block, tally and legend the PDF prints', () => {
    const flat = buildResultSheetRows(sheet()).flat().join(' | ');
    expect(flat).toContain('OFFICIAL GRADE REPORT');
    expect(flat).toContain('School Offering Course:');
    expect(flat).toContain('RAIN');
    expect(flat).toContain('C = 1');
    expect(flat).toContain('Grading System:');
    expect(flat).toContain('Approvals');
  });
});
