import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyResultListCardComponent } from './my-result-list-card.component';

describe('MyResultListCardComponent', () => {
  let component: MyResultListCardComponent;
  let fixture: ComponentFixture<MyResultListCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyResultListCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyResultListCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
