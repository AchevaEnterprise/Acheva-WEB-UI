import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateAccountBannerComponent } from './create-account-banner.component';

describe('CreateAccountBannerComponent', () => {
  let component: CreateAccountBannerComponent;
  let fixture: ComponentFixture<CreateAccountBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateAccountBannerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateAccountBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
