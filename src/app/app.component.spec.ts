import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

// The two generated tests that used to live here asserted a `title` property
// and a "Hello, achieva-frontend" heading from the Angular CLI starter. Both
// were removed from AppComponent long ago, so this file failed to COMPILE —
// and one compile error blocks the whole Karma run, which is why no spec in
// this project could execute. Kept minimal and real.
describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
