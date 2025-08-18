import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DueAnalyticsComponent } from './due-analytics.component';

describe('DueAnalyticsComponent', () => {
  let component: DueAnalyticsComponent;
  let fixture: ComponentFixture<DueAnalyticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DueAnalyticsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DueAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
