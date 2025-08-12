import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultManagementFileTableComponent } from './result-management-file-table.component';

describe('ResultManagementFileTableComponent', () => {
  let component: ResultManagementFileTableComponent;
  let fixture: ComponentFixture<ResultManagementFileTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultManagementFileTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultManagementFileTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
