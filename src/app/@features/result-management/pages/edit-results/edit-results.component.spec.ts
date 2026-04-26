import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditResultsComponent } from './edit-results.component';

describe('EditResultsComponent', () => {
  let component: EditResultsComponent;
  let fixture: ComponentFixture<EditResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditResultsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
