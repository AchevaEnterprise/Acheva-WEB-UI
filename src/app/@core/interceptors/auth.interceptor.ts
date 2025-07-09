import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthenticationService } from '../../@features/auth/service/auth.service';
import { NotificationService } from '../utility/notification.service';

const endpoints = ['/login', '/sign-up'];

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
      if (
        [HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden].includes(
          error.status satisfies HttpStatusCode
        )
      ) {
        notification.showNotification(
          'warning',
          'Unauthorized',
          'You are unauthorized'
        );
        authService.logOut();
      }

      if (
        [HttpStatusCode.NotFound].includes(
          error.status satisfies HttpStatusCode
        )
      ) {
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
