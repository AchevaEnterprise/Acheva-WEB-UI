import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DuesManagementComponent } from './dues-management.component';

describe('DuesManagementComponent', () => {
  let component: DuesManagementComponent;
  let fixture: ComponentFixture<DuesManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DuesManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DuesManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
