import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpStatusCode,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { NotificationService } from '../utility/notification.service';
import { TOAST_STATE } from '../models/notification.model';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly authService = inject(AuthenticationService);
  private readonly notification = inject(NotificationService);

  private readonly endpoints = ['/login', '/sign-up'];

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const isExcludedEndpoint = this.endpoints.some((endpoint) =>
      request.url.includes(endpoint)
    );
    const token = this.authService.getToken;

    const authReq =
      !isExcludedEndpoint && token
        ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : request;

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (
          [HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden].includes(
            error.status satisfies HttpStatusCode
          )
        ) {
          this.notification.showNotification(
            TOAST_STATE.warning,
            'You are unauthorized'
          );
          this.authService.logOut();
        }

        return throwError(() => error);
      })
    );
  }
}
