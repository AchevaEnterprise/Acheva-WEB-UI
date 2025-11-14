import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResendToDeanComponent } from './resend-to-dean.component';

describe('ResendToDeanComponent', () => {
  let component: ResendToDeanComponent;
  let fixture: ComponentFixture<ResendToDeanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResendToDeanComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResendToDeanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
