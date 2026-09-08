import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { DeleteConfirmationDialogComponent } from './app-delete-confirmation-dialog.component';

/**
 * This file previously held an empty `describe` naming a component from
 * another folder entirely. Jasmine treats a childless describe as a hard
 * error, which failed the whole run rather than one spec — so it was hiding
 * the state of every other suite.
 */
describe('DeleteConfirmationDialogComponent', () => {
  let component: DeleteConfirmationDialogComponent;
  let fixture: ComponentFixture<DeleteConfirmationDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteConfirmationDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteConfirmationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
