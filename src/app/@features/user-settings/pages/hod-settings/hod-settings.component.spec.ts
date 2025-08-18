import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HodSettingsComponent } from './hod-settings.component';

describe('HodSettingsComponent', () => {
  let component: HodSettingsComponent;
  let fixture: ComponentFixture<HodSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HodSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HodSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
