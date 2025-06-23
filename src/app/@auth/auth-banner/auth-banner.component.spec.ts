import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthBannerComponent } from './auth-banner.component';

describe('AuthBannerComponent', () => {
  let component: AuthBannerComponent;
  let fixture: ComponentFixture<AuthBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthBannerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuthBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
