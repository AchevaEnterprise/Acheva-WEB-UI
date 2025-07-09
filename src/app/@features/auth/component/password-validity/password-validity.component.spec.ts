import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PasswordValidityComponent } from './password-validity.component';

describe('PasswordValidityComponent', () => {
  let component: PasswordValidityComponent;
  let fixture: ComponentFixture<PasswordValidityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordValidityComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PasswordValidityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
