import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnassignCourseCordinatorComponent } from './unassign-course-cordinator.component';

describe('UnassignCourseCordinatorComponent', () => {
  let component: UnassignCourseCordinatorComponent;
  let fixture: ComponentFixture<UnassignCourseCordinatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnassignCourseCordinatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnassignCourseCordinatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
