import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResendToCourseCoordinatorComponent } from './resend-to-course-coordinator.component';

describe('ResendToCourseCoordinatorComponent', () => {
  let component: ResendToCourseCoordinatorComponent;
  let fixture: ComponentFixture<ResendToCourseCoordinatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResendToCourseCoordinatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResendToCourseCoordinatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
