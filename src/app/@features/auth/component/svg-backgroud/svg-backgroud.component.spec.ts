import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SvgBackgroudComponent } from './svg-backgroud.component';

describe('SvgBackgroudComponent', () => {
  let component: SvgBackgroudComponent;
  let fixture: ComponentFixture<SvgBackgroudComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SvgBackgroudComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SvgBackgroudComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
