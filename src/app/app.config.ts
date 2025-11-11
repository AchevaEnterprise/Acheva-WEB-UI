import {
  ApplicationConfig,
  isDevMode,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withPreloading,
} from '@angular/router';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideHighcharts } from 'highcharts-angular';
import { authInterceptor } from './@core/interceptors/auth.interceptor';
import { errorHandlerInterceptor } from './@core/interceptors/error-handler.interceptor';
import { retryInterceptor } from './@core/interceptors/retry.interceptor';
import { ProfileEffects } from './@core/store/profile/profile.effect';
import { profileReducer } from './@core/store/profile/profile.reducer';
import { SchoolEffects } from './@core/store/school/school.effect';
import { schoolReducer } from './@core/store/school/school.reducer';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(
      withInterceptors([
        errorHandlerInterceptor,
        retryInterceptor,
        authInterceptor,
      ])
    ),
    provideAnimationsAsync(),
    provideStore({
      profile: profileReducer,
      school: schoolReducer,
    }),
    provideEffects([ProfileEffects, SchoolEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
    provideHighcharts(),
    provideNativeDateAdapter(),
  ],
};
