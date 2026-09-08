import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { DueAnalyticsComponent } from './due-analytics.component';

describe('DueAnalyticsComponent', () => {
  let component: DueAnalyticsComponent;
  let fixture: ComponentFixture<DueAnalyticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DueAnalyticsComponent],
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
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DueAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
