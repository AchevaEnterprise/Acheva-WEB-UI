import {
  ApplicationConfig,
  isDevMode,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideHighcharts } from 'highcharts-angular';
import { provideNativeDateAdapter } from '@angular/material/core';
import { authInterceptor } from './@core/interceptors/auth.interceptor';
import { ProfileEffects } from './@core/store/profile/profile.effect';
import { profileReducer } from './@core/store/profile/profile.reducer';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideStore({
      profile: profileReducer,
    }),
    provideEffects([ProfileEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
    provideHighcharts(),
    provideNativeDateAdapter(),
  ],
};
