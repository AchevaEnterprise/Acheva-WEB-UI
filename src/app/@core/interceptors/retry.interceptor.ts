import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, throwError, timer } from 'rxjs';

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Retry once — but only a READ that failed for a transient reason (offline
 * or a 5xx). Retrying a POST/PATCH repeats a write the server may already
 * have made (a result approved or sent twice), and retrying a 4xx can only
 * fail the same way: every rejected create, wrong password or validation
 * error used to be sent twice, and each sign-in failure spent two slots of
 * the 5-per-minute sign-in limit.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (!IDEMPOTENT_METHODS.has(req.method)) return next(req);

  return next(req).pipe(
    retry({
      count: 1,
      delay: (error: unknown) =>
        error instanceof HttpErrorResponse &&
        (error.status === 0 || error.status >= 500)
          ? timer(1000)
          : throwError(() => error),
    })
  );
};
