import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultStatusTrackingComponent } from './result-status-tracking.component';

describe('ResultStatusTrackingComponent', () => {
  let component: ResultStatusTrackingComponent;
  let fixture: ComponentFixture<ResultStatusTrackingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultStatusTrackingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultStatusTrackingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
