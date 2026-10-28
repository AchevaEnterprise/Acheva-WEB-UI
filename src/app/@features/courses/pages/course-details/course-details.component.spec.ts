import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { signal } from '@angular/core';
import { importProvidersFrom } from '@angular/core';
import { NgIdleModule } from '@ng-idle/core';
import { provideStore } from '@ngrx/store';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ToastService } from '../../../../@core/utility/toast.service';
import { RoleEnum } from '../../../auth/model/auth.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { CourseDetailsComponent } from './course-details.component';

describe('CourseDetailsComponent', () => {
  let component: CourseDetailsComponent;
  let fixture: ComponentFixture<CourseDetailsComponent>;
  const account = signal<Record<string, unknown>>({
    school: { _id: 'school-1' },
    role: RoleEnum.LECTURER,
  });

  /** The role is read at construction, so it is set before creating. */
  function create(role: RoleEnum): void {
    account.set({ school: { _id: 'school-1' }, role });
    fixture = TestBed.createComponent(CourseDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseDetailsComponent],
      providers: [
        // The component reads the signed-in account during ngOnInit, so the
        // test has to be signed in as somebody.
        {
          provide: AuthenticationService,
          useValue: { activeAccount: account, getToken: 'test-token' },
        },
        // CLI stub specs configure no providers, so any component that injects
        // a service dies on DI rather than testing anything. These four cover
        // what standalone components in this app actually reach for.
        provideStore({}),
        importProvidersFrom(NgIdleModule.forRoot()),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
      ],
    })
    .compileComponents();
  });

  it('should create', () => {
    create(RoleEnum.LECTURER);
    expect(component).toBeTruthy();
  });

  describe('a course with no coordinator', () => {
    let createResult: jasmine.Spy;
    let notify: jasmine.Spy;

    function fillWithoutCoordinator(): void {
      component.form.patchValue({
        session: '2025/2026',
        semester: '1ST SEMESTER',
        admissionYear: '2025',
        level: '100',
        courseCode: { _id: 'course-1' } as never,
        courseCordinator: '',
        faculty: { _id: 'faculty-1' } as never,
        department: { _id: 'department-1' } as never,
      });
    }

    beforeEach(() => {
      // Only `status` and `data._id` are read on success; the rest of the
      // response shape is irrelevant to what is being tested.
      const created = of({ status: true, data: { _id: 'result-1' } }) as unknown as ReturnType<
        ResultsService['createResult']
      >;
      createResult = spyOn(TestBed.inject(ResultsService), 'createResult').and.returnValue(created);
      notify = spyOn(TestBed.inject(ToastService), 'showNotification');
      spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    });

    it('still lets a Course Advisor create the result to import into', () => {
      // An import is recorded as already approved and never reaches a
      // coordinator, so the empty field must not block it.
      create(RoleEnum.COURSE_ADVISOR);
      fillWithoutCoordinator();

      component.submit();

      expect(createResult).toHaveBeenCalled();
      expect(component.coordinatorPlaceholder).toContain('not needed');
    });

    it('stops a lecturer and says who can assign one', () => {
      create(RoleEnum.LECTURER);
      fillWithoutCoordinator();

      component.submit();

      expect(createResult).not.toHaveBeenCalled();
      expect(notify).toHaveBeenCalledWith(
        'error',
        'No Course Coordinator',
        jasmine.stringContaining('Head of Department')
      );
    });
  });
});
