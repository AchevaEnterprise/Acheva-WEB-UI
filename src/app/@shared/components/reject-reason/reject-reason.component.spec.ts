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

import { RejectReasonComponent } from './reject-reason.component';

describe('RejectReasonComponent', () => {
  let component: RejectReasonComponent;
  let fixture: ComponentFixture<RejectReasonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RejectReasonComponent],
      providers: [
        // A nested CommentComponent reads the signed-in account in its
        // constructor, so the tree cannot be built signed out.
        {
          provide: AuthenticationService,
          useValue: {
            activeAccount: signal({ id: 'user-1', role: 'LECTURER' }),
            getToken: 'test-token',
          },
        },
        // CLI stub specs configure no providers, so any component that injects
        // a service dies on DI rather than testing anything. These four cover
        // what standalone components in this app actually reach for.
        // A dialog component cannot be constructed outside a dialog, so the
        // two things the CDK would normally hand it are stubbed.
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        provideStore({}),
        importProvidersFrom(NgIdleModule.forRoot()),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RejectReasonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
