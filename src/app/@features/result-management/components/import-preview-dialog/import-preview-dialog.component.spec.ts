import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import {
  IImportPreviewDialogData,
  IImportPreviewResult,
  ImportPreviewDialogComponent,
} from './import-preview-dialog.component';
import {
  IImportPreview,
  IImportRowVerdict,
} from '../../models/import-preview.model';

/**
 * The check a lecturer sees before scores are written. Its job is to be
 * impossible to click through without noticing a problem, so these lock the
 * gate — what blocks Record, what only informs, and what the count says.
 */

const verdict = (over: Partial<IImportRowVerdict>): IImportRowVerdict => ({
  rowNumber: 1,
  scores: { test: 21, lab: null, exam: 54, total: 75, grade: 'A' },
  registrationNumber: '20241436385',
  nameInFile: 'AGBATA POSSIBLE SOPURU',
  nameOnRecord: 'Agbata Possible Sopuru',
  category: 'REGULAR',
  inClassList: true,
  nameAgrees: true,
  needsConfirmation: false,
  problem: null,
  belongsToDepartment: null,
  duplicateOf: [],
  ...over,
});

const preview = (over: Partial<IImportPreview> = {}): IImportPreview => ({
  isBackfill: false,
  advisories: {},
  totalRows: 1,
  regular: 1,
  reference: 0,
  unregistered: 0,
  needsConfirmation: 0,
  problems: 0,
  rows: [verdict({})],
  classList: [
    { registrationNumber: '20241436385', fullName: 'Agbata Possible Sopuru' },
    { registrationNumber: '20241439965', fullName: 'Chika Deborah Oyediya' },
  ],
  ...over,
});

describe('ImportPreviewDialogComponent', () => {
  let closed: IImportPreviewResult | undefined;

  async function mount(
    data: IImportPreview
  ): Promise<ComponentFixture<ImportPreviewDialogComponent>> {
    closed = undefined;
    await TestBed.configureTestingModule({
      imports: [ImportPreviewDialogComponent, NoopAnimationsModule],
      providers: [
        // Most components read the signed-in account during construction or
        // ngOnInit and cannot survive it being null. The stub signs the test
        // in as somebody rather than each component growing a null guard that
        // only exists to satisfy a test.
        {
          provide: AuthenticationService,
          useValue: {
            activeAccount: signal({
              id: 'user-1',
              role: 'LECTURER',
              school: { _id: 'school-1' },
              faculty: { _id: 'faculty-1' },
              department: { _id: 'dept-1' },
            }),
            accounts: signal([]),
            getToken: 'test-token',
          },
        },

        // SvgComponent fetches its icon over HTTP.
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MatDialogRef,
          useValue: {
            close: (result: IImportPreviewResult) => {
              closed = result;
            },
          },
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            preview: data,
            fileName: 'IGB102.csv',
          } satisfies IImportPreviewDialogData,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ImportPreviewDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  const text = (fixture: ComponentFixture<unknown>): string =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('lets a clean file straight through', async () => {
    const fixture = await mount(preview());
    expect(fixture.componentInstance.canImport()).toBe(true);
    expect(fixture.componentInstance.willImport()).toBe(1);
  });

  describe('a student of another department', () => {
    const data = preview({
      totalRows: 2,
      regular: 1,
      problems: 1,
      rows: [
        verdict({}),
        verdict({
          rowNumber: 2,
          registrationNumber: '20241999999',
          nameInFile: 'SOMEBODY ELSE',
          nameOnRecord: 'Somebody Else Entirely',
          category: null,
          inClassList: false,
          problem: 'DIFFERENT_DEPARTMENT',
          belongsToDepartment: 'Physics',
        }),
      ],
    });

    it('names the department it belongs to', async () => {
      const fixture = await mount(data);
      expect(text(fixture)).toContain('cannot be recorded on this result');
      expect(text(fixture)).toContain('Physics');
    });

    it('drops it from the count but never blocks the rest', async () => {
      // Refusing the whole file over one row would cost the lecturer the
      // thirteen rows that were fine.
      const fixture = await mount(data);
      expect(fixture.componentInstance.canImport()).toBe(true);
      expect(fixture.componentInstance.willImport()).toBe(1);
    });

    it('offers no way to override it', async () => {
      const fixture = await mount(data);
      const refused = fixture.componentInstance.refused();
      expect(refused.length).toBe(1);
      // It is not in the group that can be ticked or corrected.
      expect(fixture.componentInstance.mismatches().length).toBe(0);
    });
  });

  describe('a name that does not match', () => {
    const data = preview({
      totalRows: 1,
      regular: 1,
      needsConfirmation: 1,
      rows: [
        verdict({
          registrationNumber: '20241439965',
          nameInFile: 'OKPO REJOICE AMARACHI',
          nameOnRecord: 'Chika Deborah Oyediya',
          nameAgrees: false,
          needsConfirmation: true,
        }),
      ],
    });

    it('blocks Record until it is answered', async () => {
      const fixture = await mount(data);
      expect(fixture.componentInstance.canImport()).toBe(false);
      expect(fixture.componentInstance.outstanding()).toBe(1);
    });

    it('shows both names so the lecturer can tell them apart', async () => {
      const fixture = await mount(data);
      expect(text(fixture)).toContain('OKPO REJOICE AMARACHI');
      expect(text(fixture)).toContain('Chika Deborah Oyediya');
    });

    it('unblocks when the number is confirmed', async () => {
      const fixture = await mount(data);
      fixture.componentInstance.confirm(data.rows[0]);
      fixture.detectChanges();
      expect(fixture.componentInstance.canImport()).toBe(true);
    });

    it('sends a correction so the server reclassifies before writing', async () => {
      const fixture = await mount(data);
      fixture.componentInstance.correct(data.rows[0], ' 20241436385 ');
      fixture.componentInstance.proceed();
      // Trimmed: a stray space would not match any registration number.
      expect(closed?.resolutions.corrections).toEqual({ 1: '20241436385' });
    });

    it('names whose number was typed, without a round trip', async () => {
      const fixture = await mount(data);
      const row = data.rows[0];
      fixture.componentInstance.correct(row, '20241436385');
      expect(fixture.componentInstance.matchForCorrection(row)).toBe(
        'Agbata Possible Sopuru'
      );
      expect(fixture.componentInstance.canImport()).toBe(true);
    });

    it('says so when a corrected number is not on the class list', async () => {
      const fixture = await mount(data);
      const row = data.rows[0];
      fixture.componentInstance.correct(row, '99999999999');
      expect(fixture.componentInstance.matchForCorrection(row)).toBeNull();
    });

    it('treats confirming and correcting as mutually exclusive', async () => {
      const fixture = await mount(data);
      const row = data.rows[0];
      fixture.componentInstance.confirm(row);
      fixture.componentInstance.correct(row, '20241436385');
      // The tick must clear, or the two answers would contradict each other.
      expect(fixture.componentInstance.correctionFor(row)).toBe('20241436385');
    });
  });

  describe('one number, two rows', () => {
    const data = preview({
      totalRows: 2,
      regular: 0,
      problems: 2,
      rows: [
        verdict({
          rowNumber: 1,
          problem: 'DUPLICATE_IN_FILE',
          category: null,
          duplicateOf: [2],
          scores: { test: 21, lab: null, exam: 54, total: 75, grade: 'A' },
        }),
        verdict({
          rowNumber: 2,
          problem: 'DUPLICATE_IN_FILE',
          category: null,
          duplicateOf: [1],
          scores: { test: 18, lab: null, exam: 43, total: 61, grade: 'B' },
        }),
      ],
    });

    it('groups the clash and blocks until one is picked', async () => {
      const fixture = await mount(data);
      expect(fixture.componentInstance.duplicateGroups().length).toBe(1);
      expect(fixture.componentInstance.canImport()).toBe(false);
    });

    it('shows the competing scores, so the choice means something', async () => {
      const fixture = await mount(data);
      expect(text(fixture)).toContain('Total 75');
      expect(text(fixture)).toContain('Total 61');
    });

    it('records exactly one of them once picked', async () => {
      const fixture = await mount(data);
      fixture.componentInstance.pick('20241436385', 2);
      fixture.detectChanges();
      expect(fixture.componentInstance.canImport()).toBe(true);
      // Two rows in, one row out.
      expect(fixture.componentInstance.willImport()).toBe(1);
    });

    it('sends the picked row so the server writes that one', async () => {
      const fixture = await mount(data);
      fixture.componentInstance.pick('20241436385', 2);
      fixture.componentInstance.proceed();
      expect(closed?.resolutions.chosenRows).toEqual([2]);
    });
  });

  describe('reference and unregistered rows', () => {
    const data = preview({
      totalRows: 3,
      regular: 1,
      reference: 1,
      unregistered: 1,
      rows: [
        verdict({}),
        verdict({
          rowNumber: 2,
          registrationNumber: '20221330765',
          nameOnRecord: 'Martin Prosper Chinonso',
          category: 'REFERENCE',
          inClassList: false,
        }),
        verdict({
          rowNumber: 3,
          registrationNumber: '20249999999',
          nameInFile: 'NOBODY AT ALL',
          nameOnRecord: null,
          category: 'UNREGISTERED',
          inClassList: false,
        }),
      ],
    });

    it('tells the lecturer without asking them to approve each one', async () => {
      const fixture = await mount(data);
      expect(fixture.componentInstance.canImport()).toBe(true);
      expect(fixture.componentInstance.outstanding()).toBe(0);
    });

    it('explains where an unregistered row goes', async () => {
      const fixture = await mount(data);
      expect(text(fixture)).toContain('unregistered Course Advisor');
      expect(text(fixture)).toContain('Martin Prosper Chinonso');
    });

    it('counts every row it will record', async () => {
      const fixture = await mount(data);
      expect(fixture.componentInstance.willImport()).toBe(3);
    });
  });

  describe('closing', () => {
    it('reports the decisions when Record is pressed', async () => {
      const data = preview({
        needsConfirmation: 1,
        rows: [verdict({ nameAgrees: false, needsConfirmation: true })],
      });
      const fixture = await mount(data);
      fixture.componentInstance.confirm(data.rows[0]);
      fixture.componentInstance.proceed();

      expect(closed?.proceed).toBe(true);
      // Confirming means "the number is right", so nothing is corrected —
      // the server keeps what the file said and records the class list's name.
      expect(closed?.resolutions.corrections).toEqual({});
    });

    it('refuses to proceed while anything is outstanding', async () => {
      const data = preview({
        needsConfirmation: 1,
        rows: [verdict({ nameAgrees: false, needsConfirmation: true })],
      });
      const fixture = await mount(data);
      fixture.componentInstance.proceed();
      expect(closed).toBeUndefined();
    });

    it('reports nothing when cancelled', async () => {
      const fixture = await mount(preview());
      fixture.componentInstance.cancel();
      expect(closed?.proceed).toBe(false);
    });
  });
});

/* ─── Course Advisor backfill ─────────────────────────────────────────────── */

describe('ImportPreviewDialogComponent — Course Advisor backfill', () => {
  let closed: IImportPreviewResult | undefined;

  async function mount(data: IImportPreview) {
    closed = undefined;
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ImportPreviewDialogComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MatDialogRef,
          useValue: { close: (r: IImportPreviewResult) => { closed = r; } },
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { preview: data, fileName: 'archive.csv' },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ImportPreviewDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  const unknownRow = (over: Partial<IImportRowVerdict> = {}): IImportRowVerdict => ({
    rowNumber: 3,
    scores: { test: 21, lab: null, exam: 54, total: 80, grade: 'C' },
    registrationNumber: '20219999999',
    nameInFile: 'ARCHIVE STUDENT',
    nameOnRecord: null,
    category: 'UNREGISTERED',
    inClassList: false,
    nameAgrees: true,
    needsConfirmation: false,
    problem: null,
    belongsToDepartment: null,
    duplicateOf: [],
    ...over,
  });

  const backfill = (over: Partial<IImportPreview> = {}): IImportPreview => ({
    isBackfill: true,
    advisories: {
      3: ['TOTAL_DISAGREES_WITH_PARTS', 'GRADE_DISAGREES_WITH_TOTAL'],
    },
    totalRows: 1,
    regular: 0,
    reference: 0,
    unregistered: 1,
    needsConfirmation: 0,
    problems: 0,
    rows: [unknownRow()],
    classList: [],
    ...over,
  });

  const text = (fixture: ComponentFixture<unknown>): string =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('sends the advisor to the Students page for an unknown number', async () => {
    // Enrolling somebody is a deliberate act there, not a by-product of
    // filing a score.
    const fixture = await mount(
      backfill({
        unregistered: 0,
        problems: 1,
        rows: [unknownRow({ category: null, problem: 'NOT_ON_YOUR_LIST' })],
      }),
    );
    expect(text(fixture)).toContain('add them on the');
    expect(text(fixture)).toContain('Students');
    expect(text(fixture)).toContain('import this file again');
    // The row is dropped; the rest of the file still imports.
    expect(fixture.componentInstance.canImport()).toBe(true);
    expect(fixture.componentInstance.willImport()).toBe(0);
  });

  it('creates no student records from an import', async () => {
    const fixture = await mount(
      backfill({
        unregistered: 0,
        problems: 1,
        rows: [unknownRow({ category: null, problem: 'NOT_ON_YOUR_LIST' })],
      }),
    );
    fixture.componentInstance.proceed();
    // Nothing in the payload can enrol anybody.
    expect(Object.keys(closed?.resolutions ?? {})).toEqual([
      'corrections',
      'chosenRows',
    ]);
  });

  it('shows the score advisories but does not block the import', async () => {
    const fixture = await mount(backfill());
    expect(fixture.componentInstance.flagged().length).toBe(1);
    expect(text(fixture)).toContain('does not match the test, lab and exam');
    expect(text(fixture)).toContain('older scale');
    expect(fixture.componentInstance.canImport()).toBe(true);
  });

  it('tells the CA that another department will upload their own', async () => {
    const fixture = await mount(
      backfill({
        problems: 1,
        unregistered: 0,
        rows: [
          unknownRow({
            category: null,
            problem: 'DIFFERENT_DEPARTMENT',
            belongsToDepartment: 'Physics',
            nameOnRecord: 'Somebody Else',
          }),
        ],
      }),
    );
    expect(text(fixture)).toContain('Physics');
    expect(text(fixture)).toContain('own Course Advisor will upload');
  });

  it('shows no advisories on an ordinary lecturer import', async () => {
    const fixture = await mount(
      backfill({ isBackfill: false, advisories: {} }),
    );
    expect(fixture.componentInstance.flagged().length).toBe(0);
  });
});

describe('ImportPreviewDialogComponent — backfill is the CA\'s own cohort only', () => {
  let closed: IImportPreviewResult | undefined;

  async function mount(data: IImportPreview) {
    closed = undefined;
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ImportPreviewDialogComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MatDialogRef,
          useValue: { close: (r: IImportPreviewResult) => { closed = r; } },
        },
        { provide: MAT_DIALOG_DATA, useValue: { preview: data, fileName: 'a.csv' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ImportPreviewDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  const base = (rows: IImportRowVerdict[], over: Partial<IImportPreview> = {}): IImportPreview => ({
    isBackfill: true,
    advisories: {},
    totalRows: rows.length,
    regular: 0,
    reference: 0,
    unregistered: 0,
    needsConfirmation: 0,
    problems: 0,
    rows,
    classList: [],
    ...over,
  });

  const verdict = (over: Partial<IImportRowVerdict>): IImportRowVerdict => ({
    rowNumber: 1,
    scores: { test: 21, lab: null, exam: 54, total: 75, grade: 'A' },
    registrationNumber: '20241436385',
    nameInFile: 'A STUDENT',
    nameOnRecord: 'A Student',
    category: 'REGULAR',
    inClassList: true,
    nameAgrees: true,
    needsConfirmation: false,
    problem: null,
    belongsToDepartment: null,
    duplicateOf: [],
    ...over,
  });

  const text = (f: ComponentFixture<unknown>): string =>
    (f.nativeElement as HTMLElement).textContent ?? '';

  it("refuses another cohort's student and explains the duplicate risk", async () => {
    const fixture = await mount(
      base(
        [
          verdict({
            rowNumber: 2,
            registrationNumber: '20221330765',
            nameOnRecord: 'Martin Prosper Chinonso',
            category: null,
            inClassList: false,
            problem: 'NOT_YOUR_STUDENT',
          }),
        ],
        { problems: 1 },
      ),
    );
    expect(fixture.componentInstance.refused().length).toBe(1);
    expect(text(fixture)).toContain('Their own Course Advisor uploads');
    expect(text(fixture)).toContain('second copy');
    expect(fixture.componentInstance.willImport()).toBe(0);

    // A file of nothing but refusals still closes cleanly — the advisor is
    // not trapped in a dialog they cannot dismiss forwards.
    fixture.componentInstance.proceed();
    expect(closed?.proceed).toBe(true);
  });

  it('drops an unknown number from the count entirely', async () => {
    const fixture = await mount(
      base(
        [
          verdict({}),
          verdict({
            rowNumber: 2,
            registrationNumber: '20249999999',
            nameOnRecord: null,
            category: null,
            inClassList: false,
            problem: 'NOT_ON_YOUR_LIST',
          }),
        ],
        { regular: 1, problems: 1 },
      ),
    );
    // Two rows read, one refused — only one is recorded.
    expect(fixture.componentInstance.willImport()).toBe(1);
  });
});
