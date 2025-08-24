import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReferenceTableResultUploadComponent } from './reference-table-result-upload.component';

describe('ReferenceTableResultUploadComponent', () => {
  let component: ReferenceTableResultUploadComponent;
  let fixture: ComponentFixture<ReferenceTableResultUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReferenceTableResultUploadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReferenceTableResultUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
