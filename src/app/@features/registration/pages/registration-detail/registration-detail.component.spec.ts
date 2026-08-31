import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { AuthenticationService } from '../../../auth/service/auth.service';
import {
  ICourseRegistration,
  IOutstandingExcusedCourse,
  IRegistrationEntry,
  RegistrationEntryStatus,
  RegistrationEntryType,
  RegistrationStatus,
} from '../../models/registration.model';
import { RegistrationService } from '../../services/registration.service';
import { RegistrationDetailComponent } from './registration-detail.component';

/**
 * The CA's "Excuse" control and the outstanding-courses panel.
 *
 * Rule (registrar, 2026-08-14): an excused course records no grade and does
 * not touch the CGPA, but it is still owed and returns later as an ORDINARY
 * registration — never a carry-over. These tests pin the wording the CA sees
 * before committing, because that is where the distinction is either made
 * clear or lost.
 */

function entry(overrides: Partial<IRegistrationEntry> = {}): IRegistrationEntry {
  return {
    _id: 'e1',
    course: 'c1',
    courseCode: 'MTH301',
    courseTitle: 'Linear Algebra',
    units: 3,
    type: RegistrationEntryType.COMPULSORY,
    status: RegistrationEntryStatus.REGISTERED,
    source: 'AUTO',
    electiveGroup: null,
    carriedFromSession: null,
    note: null,
    droppedReason: null,
    ...overrides,
  } as IRegistrationEntry;
}

function registration(
  entries: IRegistrationEntry[] = [entry()]
): ICourseRegistration {
  return {
    _id: 'r1',
    student: { _id: 's1', fullName: 'Ada Obi', registrationNumber: '2019/1234' },
    session: '2026/2027',
    semester: '1ST SEMESTER',
    level: '300',
    status: RegistrationStatus.ACTIVE,
    totalUnits: 18,
    nonSiwesUnits: 18,
    entries,
    unplacedCarryOvers: [],
    decisionTrace: [],
  } as unknown as ICourseRegistration;
}

const excusedCourse: IOutstandingExcusedCourse = {
  courseId: 'c1',
  courseCode: 'MTH301',
  courseTitle: 'Linear Algebra',
  units: 3,
  courseSemester: '1ST SEMESTER',
  originalType: RegistrationEntryType.COMPULSORY,
  excusedInSession: '2026/2027',
  excusedInLevel: '300',
  excusedAt: null,
};

describe('RegistrationDetailComponent — excusing a course', () => {
  let fixture: ComponentFixture<RegistrationDetailComponent>;
  let component: RegistrationDetailComponent;
  let dialogData: { message: string; subTitle: string } | null;
  let confirmed: boolean;
  let excuseCalls: { id: string; courseId: string }[];
  let outstanding: IOutstandingExcusedCourse[];

  async function setup() {
    dialogData = null;
    confirmed = true;
    excuseCalls = [];

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RegistrationDetailComponent],
      providers: [
        // Root services in the component tree still reach for HttpClient even
        // though every call site here is mocked.
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: RegistrationService,
          useValue: {
            findOne: () => of({ data: registration() }),
            cgpa: () => of({ data: null }),
            carryOvers: () => of({ data: [] }),
            excusedCourses: () => of({ data: outstanding }),
            curriculum: () => of({ data: [] }),
            excuseCourse: (id: string, courseId: string) => {
              excuseCalls.push({ id, courseId });
              return of({ data: registration([]) });
            },
            editEntries: () => of({ data: registration([]) }),
          },
        },
        {
          provide: MatDialog,
          useValue: {
            open: (_c: unknown, config: { data: typeof dialogData }) => {
              dialogData = config.data;
              return { afterClosed: () => of(confirmed) };
            },
          },
        },
        { provide: ToastService, useValue: { showNotification: () => undefined } },
        {
          provide: AuthenticationService,
          useValue: { activeAccount: () => ({ department: { _id: 'd1' } }) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'r1' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrationDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** `fixture.nativeElement` is `any`; narrow it once here. */
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    outstanding = [];
    await setup();
  });

  describe('the confirmation the CA sees', () => {
    it('warns that it is only for a school-approved absence', async () => {
      component.excuseEntry(entry());
      expect(dialogData?.subTitle).toContain('school approved');
    });

    it('states that no grade is recorded and the CGPA is untouched', () => {
      component.excuseEntry(entry());
      expect(dialogData?.subTitle).toContain('No grade is recorded');
      expect(dialogData?.subTitle).toContain('CGPA is not affected');
    });

    it('states the course is NOT a carry-over', () => {
      component.excuseEntry(entry());
      expect(dialogData?.subTitle).toContain('not a');
      expect(dialogData?.subTitle).toContain('carry-over');
    });

    it('states the course is still outstanding', () => {
      component.excuseEntry(entry());
      expect(dialogData?.subTitle).toContain('stays outstanding');
    });
  });

  it('calls the excuse endpoint once confirmed', () => {
    component.excuseEntry(entry());
    expect(excuseCalls).toEqual([{ id: 'r1', courseId: 'c1' }]);
  });

  it('does nothing when the CA cancels', () => {
    confirmed = false;
    component.excuseEntry(entry());
    expect(excuseCalls).toEqual([]);
  });

  describe('the outstanding panel', () => {
    it('is hidden when there is nothing outstanding', () => {
      expect(component.excusedCourses()).toEqual([]);
      expect(host().querySelector('.rd-outstanding')).toBeNull();
    });

    it('lists an excused course with the type it will return as', async () => {
      outstanding = [excusedCourse];
      await setup();

      expect(component.excusedCourses().length).toBe(1);
      const panel = host().querySelector('.rd-outstanding');
      expect(panel).not.toBeNull();
      expect(panel?.textContent).toContain('MTH301');
      // The distinction that matters: it returns as COMPULSORY, not CARRYOVER.
      expect(panel?.textContent).toContain('COMPULSORY');
      expect(panel?.textContent).not.toContain('CARRYOVER');
    });

    it('tells the CA it is not a carry-over', async () => {
      outstanding = [excusedCourse];
      await setup();

      const panel = host().querySelector('.rd-outstanding');
      expect(panel?.textContent).toContain('not a carry-over');
    });
  });
});
