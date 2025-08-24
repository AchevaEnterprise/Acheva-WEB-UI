import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApproveRejectResultComponent } from './approve-reject-result.component';

describe('ApproveRejectResultComponent', () => {
  let component: ApproveRejectResultComponent;
  let fixture: ComponentFixture<ApproveRejectResultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApproveRejectResultComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApproveRejectResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
