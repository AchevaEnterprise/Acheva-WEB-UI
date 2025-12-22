import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnregisteredTableResultUploadComponent } from './unregistered-table-result-upload.component';

describe('UnregisteredTableResultUploadComponent', () => {
  let component: UnregisteredTableResultUploadComponent;
  let fixture: ComponentFixture<UnregisteredTableResultUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnregisteredTableResultUploadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnregisteredTableResultUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
