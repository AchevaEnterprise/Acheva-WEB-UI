import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultUploadComponent } from './result-upload.component';

describe('ResultUploadComponent', () => {
  let component: ResultUploadComponent;
  let fixture: ComponentFixture<ResultUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultUploadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
