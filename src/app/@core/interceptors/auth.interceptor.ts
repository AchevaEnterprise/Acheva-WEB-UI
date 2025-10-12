import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Subject, switchMap, take, throwError } from 'rxjs';
import { AuthenticationService } from '../../@features/auth/service/auth.service';
import { ToastService } from '../utility/toast.service';

const endpoints = [
  '/auth/lecturers/register',
  '/auth/lecturers/signin',
  '/auth/lecturers/refresh-token',
  
 '/auth/lecturers/switch-account', // Confirm is this doesn't need being authenticated
  '/auth/resend-email-verification',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
];

let refreshInProgress = false;
let refreshSubject = new Subject<string>();
let refreshFailureCount = 0;
const maxRefreshFailures = 2;
let lastRefreshFailure = 0;
const refreshCooldownMs = 30000; // 30 seconds

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthenticationService);
  const toast = inject(ToastService);

  const isExcludedEndpoint = endpoints.some((endpoint) =>
    req.url.includes(endpoint)
  );

  const token = authService.getToken;

  const authReq =
    !isExcludedEndpoint && token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === HttpStatusCode.Unauthorized) {
        console.log('Received 401 Unauthorized response');
        const refreshToken = authService.getRefreshToken;

        if (!refreshToken) {
          console.log('No refresh token found, logging out');
          authService.logOut();
          toast.showNotification(
            'warning',
            'Session Expired',
            'Please sign in again.'
          );
          return throwError(() => error);
        }

        if (refreshInProgress) {
          return refreshSubject.pipe(
            take(1),
            switchMap((newToken) => {
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              });
              return next(retryReq);
            })
          );
        }

        refreshInProgress = true;

        // Check circuit breaker
        const now = Date.now();
        if (refreshFailureCount >= maxRefreshFailures && 
            (now - lastRefreshFailure) < refreshCooldownMs) {
          console.log('Refresh circuit breaker active, forcing logout');
          authService.logOut();
          return throwError(() => new Error('Token refresh circuit breaker active'));
        }

        console.log('Attempting to refresh token');
        return authService.refreshToken(refreshToken).pipe(
          switchMap((res) => {
            console.log('Token refresh successful');
            const { accessToken, refreshToken: newRefreshToken } = res.data;
            authService.setToken(accessToken);
            authService.setRefreshToken(newRefreshToken);

            refreshSubject.next(accessToken);
            refreshSubject.complete();

            refreshInProgress = false;
            refreshSubject = new Subject<string>(); // reinitialize
            
            // Reset failure count on success
            refreshFailureCount = 0;

            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${accessToken}` },
            });
            return next(retryReq);
          }),
          catchError((refreshError) => {
            console.log('Token refresh failed:', refreshError.status, refreshError.message);
            refreshInProgress = false;
            refreshSubject.complete();
            refreshSubject = new Subject<string>(); // reinitialize
            
            // Update circuit breaker state
            refreshFailureCount++;
            lastRefreshFailure = Date.now();
            
            // Force logout after max failures
            if (refreshFailureCount >= maxRefreshFailures) {
              console.log('Max refresh failures reached, forcing logout');
            }
            
            authService.logOut();
            toast.showNotification(
              'warning',
              'Session Expired',
              'Please sign in again.'
            );
            return throwError(() => refreshError);
          })
        );
      }

      if (error.status === HttpStatusCode.Forbidden) {
        toast.showNotification(
          'warning',
          'Unauthorized',
          error.error.message || 'You are unauthorized'
        );
      }

      if (error.status === HttpStatusCode.NotFound) {
        toast.showNotification(
          'warning',
          'Resource Not Found',
          error.error.message ||
            'The resource you are trying to access does not exist'
        );
      }

      if (error.status === HttpStatusCode.InternalServerError) {
        toast.showNotification(
          'warning',
          'Internal Server Error',
          'An error occured while processing your request. Please try again later.'
        );
      }

      return throwError(() => error);
    })
  );
};
