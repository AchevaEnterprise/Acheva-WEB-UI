import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyResultGridCardComponent } from './my-result-grid-card.component';

describe('MyResultGridCardComponent', () => {
  let component: MyResultGridCardComponent;
  let fixture: ComponentFixture<MyResultGridCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyResultGridCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyResultGridCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
