import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignCourseCoordinatorComponent } from './assign-course-coordinator.component';

describe('AssignCourseCoordinatorComponent', () => {
  let component: AssignCourseCoordinatorComponent;
  let fixture: ComponentFixture<AssignCourseCoordinatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignCourseCoordinatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignCourseCoordinatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
