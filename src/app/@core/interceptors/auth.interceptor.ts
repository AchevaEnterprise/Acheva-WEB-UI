import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

const endpoints = [
  '/auth/lecturers/register',
  '/auth/lecturers/signin',
  '/auth/lecturers/refresh-token',
  '/auth/resend-email-verification',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthenticationService);

  const isExcludedEndpoint = endpoints.some((endpoint) =>
    req.url.includes(endpoint)
  );

  const token = authService.getToken;

  const authReq =
    !isExcludedEndpoint && token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq);
};
