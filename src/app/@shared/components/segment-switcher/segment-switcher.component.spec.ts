import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SegmentSwitcherComponent } from './segment-switcher.component';

describe('SegmentSwitcherComponent', () => {
  let component: SegmentSwitcherComponent;
  let fixture: ComponentFixture<SegmentSwitcherComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SegmentSwitcherComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SegmentSwitcherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
