import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthenticationService } from '../../../@features/auth/service/auth.service';
import { importProvidersFrom } from '@angular/core';
import { NgIdleModule } from '@ng-idle/core';
import { provideStore } from '@ngrx/store';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { AssignCourseCoordinatorComponent } from './assign-course-coordinator.component';

describe('AssignCourseCoordinatorComponent', () => {
  let component: AssignCourseCoordinatorComponent;
  let fixture: ComponentFixture<AssignCourseCoordinatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignCourseCoordinatorComponent],
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

        // CLI stub specs configure no providers, so any component that injects
        // a service dies on DI rather than testing anything. These four cover
        // what standalone components in this app actually reach for.
        provideStore({}),
        // A dialog component cannot be constructed outside a dialog, so the
        // two things the CDK would normally hand it are stubbed.
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        importProvidersFrom(NgIdleModule.forRoot()),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignCourseCoordinatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
