import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignCourseAdvisorComponent } from './assign-course-advisor.component';

describe('AssignCourseAdvisorComponent', () => {
  let component: AssignCourseAdvisorComponent;
  let fixture: ComponentFixture<AssignCourseAdvisorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignCourseAdvisorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignCourseAdvisorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
