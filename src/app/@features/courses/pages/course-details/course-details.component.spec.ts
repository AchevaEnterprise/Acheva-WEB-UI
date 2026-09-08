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

import { CourseDetailsComponent } from './course-details.component';

describe('CourseDetailsComponent', () => {
  let component: CourseDetailsComponent;
  let fixture: ComponentFixture<CourseDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseDetailsComponent],
      providers: [
        // The component reads the signed-in account during ngOnInit, so the
        // test has to be signed in as somebody.
        {
          provide: AuthenticationService,
          useValue: {
            activeAccount: signal({ school: { _id: 'school-1' }, role: 'LECTURER' }),
            getToken: 'test-token',
          },
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

    fixture = TestBed.createComponent(CourseDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
