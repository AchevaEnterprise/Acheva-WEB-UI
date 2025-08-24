import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnassignCourseAdvisorComponent } from './unassign-course-advisor.component';

describe('UnassignCourseAdvisorComponent', () => {
  let component: UnassignCourseAdvisorComponent;
  let fixture: ComponentFixture<UnassignCourseAdvisorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnassignCourseAdvisorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnassignCourseAdvisorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
