import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegularTableResultUploadComponent } from './regular-table-result-upload.component';

describe('RegularTableResultUploadComponent', () => {
  let component: RegularTableResultUploadComponent;
  let fixture: ComponentFixture<RegularTableResultUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegularTableResultUploadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegularTableResultUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
