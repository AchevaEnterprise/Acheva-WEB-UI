import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultManagementFolderTableComponent } from './result-management-folder-table.component';

describe('ResultManagementFolderTableComponent', () => {
  let component: ResultManagementFolderTableComponent;
  let fixture: ComponentFixture<ResultManagementFolderTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultManagementFolderTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultManagementFolderTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
