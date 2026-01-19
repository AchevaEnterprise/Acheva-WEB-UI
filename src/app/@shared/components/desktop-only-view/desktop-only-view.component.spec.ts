import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesktopOnlyViewComponent } from './desktop-only-view.component';

describe('DesktopOnlyViewComponent', () => {
  let component: DesktopOnlyViewComponent;
  let fixture: ComponentFixture<DesktopOnlyViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesktopOnlyViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DesktopOnlyViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
