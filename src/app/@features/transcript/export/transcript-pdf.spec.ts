import {
  ITranscript,
  ITranscriptCourse,
  ITranscriptTotals,
} from '../models/transcript.model';
import {
  TranscriptDocument,
  buildTranscriptPdf,
  formatLongDate,
  transcriptFileName,
} from './transcript-pdf';

/**
 * Locks the layout of the printed academic record.
 *
 * The arrangement is copied from photographs of two real FUTO transcripts, so
 * a change here means the printed document stops matching the paper one the
 * Registry issues. The figures in the fixture are the figures those scans
 * print — 41 units, 153 grade points, 3.73 — which is what makes the
 * assertions about the totals row meaningful rather than circular.
 */

const totals = (
  units: number,
  gradePoints: number,
  gpa: number
): ITranscriptTotals => ({ units, gradePoints, gpa });

const course = (
  code: string,
  title: string,
  units: number | null,
  grade: string | null,
  gradePoints: number | null,
  over: Partial<ITranscriptCourse> = {}
): ITranscriptCourse => ({
  code,
  title,
  units,
  grade,
  gradePoints,
  total: null,
  status: grade === 'F' ? 'FAIL' : 'PASS',
  moderated: false,
  counted: true,
  ...over,
});

const HARMATTAN = [
  course('MTH101', 'Elementary Mathematics I', 4, 'B', 16),
  course('ENG103', 'Engineering Drawing I', 1, 'D', 2),
];
const RAIN = [
  course('PHY102', 'General Physics II', 4, 'A', 20),
  course('ENG104', 'Engineering Drawing II', 1, 'F', 0),
];

const transcript = (over: Partial<ITranscript> = {}): ITranscript => ({
  institution: 'Federal University of Technology, Owerri',
  student: {
    fullName: 'Azubuike Chiagozie Chidiebube',
    registrationNumber: '20171064153',
    school: 'Engineering & Engineering Technology',
    department: 'Mechanical Engineering',
    sex: 'MALE',
    dateOfBirth: '2001-12-04T00:00:00.000Z',
    nationality: 'Nigerian',
    stateOfOrigin: 'Imo',
    modeOfEntry: 'UME',
    programmeOption: 'Industrial & Production Engineering',
    dateOfEntry: '2017/2018',
  },
  sessions: [
    {
      session: '2017/2018',
      broughtForward: null,
      semesters: [
        {
          semester: '1ST SEMESTER',
          label: 'HARMATTAN',
          heading: '2017/2018 HARMATTAN SEMESTER',
          level: '100',
          courses: HARMATTAN,
          totals: totals(5, 18, 3.6),
          cumulative: totals(5, 18, 3.6),
        },
        {
          semester: '2ND SEMESTER',
          label: 'RAIN',
          heading: '2017/2018 RAIN SEMESTER',
          level: '100',
          courses: RAIN,
          totals: totals(5, 20, 4),
          cumulative: totals(10, 38, 3.8),
        },
      ],
      totals: totals(10, 38, 3.8),
      cumulative: totals(10, 38, 3.8),
    },
  ],
  cumulative: totals(41, 153, 3.73),
  gradingScale: [
    { grade: 'A', min: 70, max: 100, points: 5, description: 'Excellent' },
    { grade: 'F', min: 0, max: 39, points: 0, description: 'Failure' },
  ],
  classificationScales: [
    {
      era: '1991 - DATE',
      bands: [{ label: '1st Class Honours', min: 4.5, max: 5.0 }],
    },
  ],
  courseAdvisor: 'Dr Chidi Okonkwo',
  generatedAt: '2026-08-27T09:00:00.000Z',
  notices: [],
  ...over,
});

/** Every text string in the document, flattened, for containment assertions. */
function texts(node: unknown, into: string[] = []): string[] {
  if (node === null || node === undefined) return into;
  if (typeof node === 'string') {
    into.push(node);
    return into;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => texts(child, into));
    return into;
  }
  if (typeof node === 'object') {
    Object.values(node as Record<string, unknown>).forEach((value) =>
      texts(value, into)
    );
  }
  return into;
}

function allText(doc: TranscriptDocument): string {
  return texts(doc.content).join('\n');
}

/** The grades table — the only table with six columns. */
function courseTable(doc: TranscriptDocument): { body: unknown[][] } {
  const found = (doc.content as Record<string, unknown>[]).find((block) => {
    const table = block?.['table'] as { widths?: unknown[] } | undefined;
    return table?.widths?.length === 6;
  });
  return (found as Record<string, unknown>)['table'] as { body: unknown[][] };
}

/** The header grid — the only table with four columns. */
function headerTable(doc: TranscriptDocument): { body: unknown[][] } {
  const found = (doc.content as Record<string, unknown>[]).find((block) => {
    const table = block?.['table'] as { widths?: unknown[] } | undefined;
    return table?.widths?.length === 4;
  });
  return (found as Record<string, unknown>)['table'] as { body: unknown[][] };
}

const cellText = (row: unknown[], index: number): string =>
  ((row[index] as { text?: string })?.text ?? '') as string;

describe('buildTranscriptPdf — the masthead', () => {
  it('names the institution and the document', () => {
    const text = allText(buildTranscriptPdf(transcript()));
    expect(text).toContain('FEDERAL UNIVERSITY OF TECHNOLOGY, OWERRI');
    expect(text).toContain("STUDENT'S ACADEMIC RECORD");
  });

  it('never claims to come from the Registrar', () => {
    // The paper form is issued by the Registrar and says so. This document is
    // not, and printing that line would be a claim of authority Acheva does
    // not hold — see the note at the top of transcript-pdf.ts.
    const text = allText(buildTranscriptPdf(transcript()));
    expect(text).not.toContain('OFFICE OF THE REGISTRAR');
    expect(text).not.toContain('FOR: REGISTRAR');
    expect(text).not.toContain("STUDENT'S COPY");
    expect(text).toContain("not the Registrar's official transcript");
  });

  it('asserts no degree classification of its own', () => {
    // The tables are printed; which band applies is the Senate's call at
    // graduation. A CGPA that is still moving has no class.
    const text = allText(buildTranscriptPdf(transcript()));
    expect(text).toContain('DEGREE CLASSIFICATION - (1991 - DATE)');
    expect(text).not.toMatch(/^(1st|2nd|Third) Class Honours$/m);
  });
});

describe('buildTranscriptPdf — the header grid', () => {
  it('prints the Registry header fields in the order the form does', () => {
    const body = headerTable(buildTranscriptPdf(transcript())).body;
    expect(body[0].map((_, i) => cellText(body[0], i))).toEqual([
      'Name of Student',
      'Sex',
      'Date of Birth',
      'Reg. No.',
    ]);
    expect(cellText(body[1], 0)).toBe('AZUBUIKE CHIAGOZIE CHIDIEBUBE');
    expect(cellText(body[1], 2)).toBe('4 December 2001');
    expect(cellText(body[1], 3)).toBe('20171064153');
    expect(cellText(body[2], 0)).toBe('Nationality');
    expect(cellText(body[3], 3)).toBe('UME');
  });

  it('drops the origin row pair entirely when none of it is recorded', () => {
    // A school that has never collected these gets a tighter block rather
    // than a row of empty boxes, which reads as a defective document.
    const sparse = transcript({
      student: {
        ...transcript().student,
        nationality: null,
        stateOfOrigin: null,
        modeOfEntry: null,
        dateOfEntry: null,
      },
    });
    const body = headerTable(buildTranscriptPdf(sparse)).body;
    expect(body.map((row) => cellText(row, 0))).not.toContain('Nationality');
  });

  it('keeps the row pair when only some of it is recorded', () => {
    const partial = transcript({
      student: {
        ...transcript().student,
        nationality: null,
        stateOfOrigin: null,
        modeOfEntry: null,
      },
    });
    const body = headerTable(buildTranscriptPdf(partial)).body;
    expect(body.map((row) => cellText(row, 0))).toContain('Nationality');
    // Blank, not an em-dash: on a ruled form an empty cell reads as
    // "not recorded" without looking like a rendering failure.
    expect(cellText(body[3], 0)).toBe('');
    expect(cellText(body[3], 2)).toBe('2017/2018');
  });
});

describe('buildTranscriptPdf — the grades table', () => {
  it('uses the Registry column titles, in order', () => {
    const header = courseTable(buildTranscriptPdf(transcript())).body[0];
    expect(header.map((_, i) => cellText(header, i))).toEqual([
      'Course\nCode',
      'Title of Course',
      'Units',
      'Grade',
      'Total Grade\nPoints',
      'Cum\nG.P.A.',
    ]);
  });

  it('opens each semester with the printed session heading', () => {
    const body = courseTable(buildTranscriptPdf(transcript())).body;
    const headings = body.map((row) => cellText(row, 1));
    expect(headings).toContain('2017/2018 HARMATTAN SEMESTER');
    expect(headings).toContain('2017/2018 RAIN SEMESTER');
  });

  it('prints an F as 0 grade points, because 0 is what an F earns', () => {
    const body = courseTable(buildTranscriptPdf(transcript())).body;
    const failing = body.find((row) => cellText(row, 0) === 'ENG104');
    expect(cellText(failing as unknown[], 3)).toBe('F');
    expect(cellText(failing as unknown[], 4)).toBe('0');
  });

  it('leaves grade points BLANK for a row that does not count', () => {
    // The distinction is the point: a 0 here would read as a failure, when
    // the score is simply held pending the Course Advisor's decision.
    const held = transcript({
      sessions: [
        {
          ...transcript().sessions[0],
          semesters: [
            {
              ...transcript().sessions[0].semesters[0],
              courses: [
                course('GST101', 'Use of English I', 2, 'C', null, {
                  counted: false,
                }),
              ],
            },
          ],
        },
      ],
    });
    const body = courseTable(buildTranscriptPdf(held)).body;
    const row = body.find((r) => cellText(r, 0) === 'GST101') as unknown[];
    expect(cellText(row, 3)).toBe('C');
    expect(cellText(row, 4)).toBe('');
  });

  it('marks moderated and held rows so the notes can explain them', () => {
    const marked = transcript({
      sessions: [
        {
          ...transcript().sessions[0],
          semesters: [
            {
              ...transcript().sessions[0].semesters[0],
              courses: [
                course('ENG104', 'Engineering Drawing II', 1, 'E', 1, {
                  moderated: true,
                }),
                course('GST101', 'Use of English I', 2, 'C', null, {
                  counted: false,
                }),
              ],
            },
          ],
        },
      ],
    });
    const body = courseTable(buildTranscriptPdf(marked)).body;
    expect(cellText(body.find((r) => cellText(r, 0) === 'ENG104') as unknown[], 1)).toContain('†');
    expect(cellText(body.find((r) => cellText(r, 0) === 'GST101') as unknown[], 1)).toContain('‡');
  });

  it('states the semester GPA and the running CGPA at each semester close', () => {
    // These two figures are the only standing this document claims. The
    // semester GPA is spelled out in the title column; the last column stays
    // strictly cumulative, because that is what its heading says.
    const body = courseTable(buildTranscriptPdf(transcript())).body;

    const harmattan = body.find((row) =>
      cellText(row, 1).startsWith('SEMESTER GPA')
    ) as unknown[];
    expect(cellText(harmattan, 1)).toBe('SEMESTER GPA 3.60');
    expect(cellText(harmattan, 2)).toBe('5');
    expect(cellText(harmattan, 4)).toBe('18');
    expect(cellText(harmattan, 5)).toBe('3.60');

    const rain = body.filter((row) =>
      cellText(row, 1).startsWith('SEMESTER GPA')
    )[1];
    expect(cellText(rain, 1)).toBe('SEMESTER GPA 4.00');
    // The semester earned 4.00, but the record stands at 3.80 overall.
    expect(cellText(rain, 5)).toBe('3.80');
  });

  it('closes with the cumulative figures the whole document exists to state', () => {
    const body = courseTable(buildTranscriptPdf(transcript())).body;
    const last = body[body.length - 1];
    expect(cellText(last, 2)).toBe('41');
    expect(cellText(last, 4)).toBe('153');
    expect(cellText(last, 5)).toBe('3.73');
  });

  it('adds a per-session subtotal only when there is more than one session', () => {
    const single = courseTable(buildTranscriptPdf(transcript())).body;
    expect(single.map((row) => cellText(row, 1))).not.toContain(
      'TOTAL AS AT 2017/2018'
    );

    const base = transcript();
    const multi = transcript({
      sessions: [
        base.sessions[0],
        { ...base.sessions[0], session: '2018/2019' },
      ],
    });
    const rows = courseTable(buildTranscriptPdf(multi)).body;
    expect(rows.map((row) => cellText(row, 1))).toContain(
      'TOTAL AS AT 2017/2018'
    );
  });

  it('opens with a carry-forward line when the record has history behind it', () => {
    const base = transcript();
    const continued = transcript({
      sessions: [
        { ...base.sessions[0], broughtForward: totals(41, 169, 4.12) },
      ],
    });
    const body = courseTable(buildTranscriptPdf(continued)).body;
    const carried = body.find((row) => cellText(row, 1) === 'Brought forward');
    expect(cellText(carried as unknown[], 2)).toBe('41');
    expect(cellText(carried as unknown[], 4)).toBe('169');
  });
});

describe('buildTranscriptPdf — attribution', () => {
  it('names the Course Advisor as text, with no signature line', () => {
    const text = allText(buildTranscriptPdf(transcript()));
    expect(text).toContain('COURSE ADVISOR');
    expect(text).toContain('DR CHIDI OKONKWO');
  });

  it('says a preview carries no serial', () => {
    const text = allText(buildTranscriptPdf(transcript()));
    expect(text).toContain('Preview only');
    expect(text).not.toContain('VERIFY THIS DOCUMENT');
  });

  it('prints the serial and the host beside the QR on an issued copy', () => {
    const doc = buildTranscriptPdf(transcript(), {
      serial: 'ACV-7F3A-91BD-4KX2',
      verifyUrl: 'https://verify.acheva.app/ACV-7F3A-91BD-4KX2',
      qrDataUrl: 'data:image/png;base64,AAA',
    });
    const text = allText(doc);
    expect(text).toContain('VERIFY THIS DOCUMENT');
    expect(text).toContain('ACV-7F3A-91BD-4KX2');
    // The host, not the full URL — shorter to read off paper.
    expect(text).toContain('verify.acheva.app');
    // Tells the reader to COMPARE, not merely that a serial exists.
    expect(text).toContain('matches this document');
  });
});

describe('buildTranscriptPdf — notes', () => {
  it('prints no notes block when the record is unremarkable', () => {
    const text = allText(buildTranscriptPdf(transcript()));
    expect(text).not.toContain('awaiting a registration decision');
  });

  it('prints the notes the server decided this record needs', () => {
    const text = allText(
      buildTranscriptPdf(transcript({ notices: ['A note about this record.'] }))
    );
    expect(text).toContain('A note about this record.');
  });
});

describe('helpers', () => {
  it('formats a date of birth the long way the form prints it', () => {
    expect(formatLongDate('2001-12-04T00:00:00.000Z')).toBe('4 December 2001');
    expect(formatLongDate(null)).toBe('');
    expect(formatLongDate('not a date')).toBe('');
  });

  it('names the file after the registration number', () => {
    expect(transcriptFileName(transcript())).toBe(
      '20171064153_Academic_Record'
    );
  });
});
