import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadResultDialogComponent } from './upload-result-dialog.component';

describe('UploadResultDialogComponent', () => {
  let component: UploadResultDialogComponent;
  let fixture: ComponentFixture<UploadResultDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadResultDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadResultDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
