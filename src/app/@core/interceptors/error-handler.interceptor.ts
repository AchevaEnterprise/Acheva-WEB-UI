import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Subject, switchMap, take, throwError } from 'rxjs';
import { AuthenticationService } from '../../@features/auth/service/auth.service';
import { ToastService } from '../utility/toast.service';

let refreshInProgress = false;
let refreshSubject = new Subject<string>();
let refreshFailureCount = 0;
const maxRefreshFailures = 2;
let lastRefreshFailure = 0;
const refreshCooldownMs = 30000; // 30 seconds

export const errorHandlerInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthenticationService);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === HttpStatusCode.Unauthorized) {
        const refreshToken = authService.getRefreshToken;

        if (!refreshToken) {
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

        // Circuit breaker check
        const now = Date.now();
        if (
          refreshFailureCount >= maxRefreshFailures &&
          now - lastRefreshFailure < refreshCooldownMs
        ) {
          authService.logOut();
          return throwError(
            () => new Error('Token refresh circuit breaker active')
          );
        }

        return authService.refreshToken(refreshToken).pipe(
          switchMap((res) => {
            const { accessToken, refreshToken: newRefreshToken } = res.data;
            authService.setToken(accessToken);
            authService.setRefreshToken(newRefreshToken);

            refreshSubject.next(accessToken);
            refreshSubject.complete();

            refreshInProgress = false;
            refreshSubject = new Subject<string>(); // reinitialize
            refreshFailureCount = 0;

            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${accessToken}` },
            });
            return next(retryReq);
          }),
          catchError((refreshError) => {
            refreshInProgress = false;
            refreshSubject.complete();
            refreshSubject = new Subject<string>();

            refreshFailureCount++;
            lastRefreshFailure = Date.now();

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

      // Requests tagged with X-Silent-Error skip all toasts — used for
      // background enrichment calls where a failure should be invisible to users.
      const silent = req.headers.has('X-Silent-Error');
      if (silent) return throwError(() => error);

      if (error.status === HttpStatusCode.Forbidden) {
        toast.showNotification(
          'error',
          'Access Denied',
          "You don't have permission to do that. If you think this is a mistake, contact your administrator."
        );
      }

      if (error.status === HttpStatusCode.BadRequest) {
        toast.showNotification(
          'error',
          'Invalid Request',
          error.error?.message ||
            'Some of the information you provided is not valid. Please check and try again.'
        );
      }

      if (error.status === HttpStatusCode.Conflict) {
        toast.showNotification(
          'error',
          'Already Exists',
          error.error?.message ||
            'A record with this information already exists.'
        );
      }

      if (error.status === HttpStatusCode.NotFound) {
        toast.showNotification(
          'error',
          'Not Found',
          'The information you requested could not be found. It may have been removed or the link may be incorrect.'
        );
      }

      if (error.status === HttpStatusCode.InternalServerError) {
        toast.showNotification(
          'error',
          'Something Went Wrong',
          'An unexpected error occurred on our end. Please try again in a moment. If the problem continues, contact support.'
        );
      }

      return throwError(() => error);
    })
  );
};
