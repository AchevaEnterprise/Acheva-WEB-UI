import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Subject, switchMap, take, throwError } from 'rxjs';
import { AuthenticationService } from '../../@features/auth/service/auth.service';
import { NotificationService } from '../utility/notification.service';

const endpoints = [
  '/auth/lecturers/register',
  '/auth/lecturers/signin',
  '/auth/lecturers/refresh-token',
  '/auth/lecturers/linked-accounts', // Confirm is this doesn't need being authenticated
  '/auth/lecturers/switch-account', // Confirm is this doesn't need being authenticated
  '/auth/resend-email-verification',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
];

let refreshInProgress = false;
let refreshSubject = new Subject<string>();

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthenticationService);
  const notification = inject(NotificationService);

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
        const refreshToken = authService.getRefreshToken;

        if (!refreshToken) {
          authService.logOut();
          notification.showNotification(
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

        return authService.refreshToken(refreshToken).pipe(
          switchMap((res) => {
            const { accessToken, refreshToken } = res.data;
            authService.setToken(accessToken);
            authService.setRefreshToken(refreshToken);

            refreshSubject.next(accessToken);
            refreshSubject.complete();

            refreshInProgress = false;
            refreshSubject = new Subject<string>(); // reinitialize

            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${accessToken}` },
            });
            return next(retryReq);
          }),
          catchError((refreshError) => {
            authService.logOut();
            notification.showNotification(
              'warning',
              'Session Expired',
              'Please sign in again.'
            );
            return throwError(() => refreshError);
          })
        );
      }

      if (error.status === HttpStatusCode.Forbidden) {
        notification.showNotification(
          'warning',
          'Unauthorized',
          'You are unauthorized'
        );
        authService.logOut();
      }

      if (error.status === HttpStatusCode.NotFound) {
        notification.showNotification(
          'warning',
          'Resource Not Found',
          'The resource you are trying to access does not exist'
        );
      }

      return throwError(() => error);
    })
  );
};
