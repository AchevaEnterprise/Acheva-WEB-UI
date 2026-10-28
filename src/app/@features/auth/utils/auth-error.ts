import { HttpErrorResponse } from '@angular/common/http';

export interface IAuthErrorText {
  readonly title: string;
  readonly message: string;
}

/**
 * Plain-language text for a failed sign-in, email-verification or
 * password-reset call. These requests are sent with `X-Silent-Error`, so the
 * global interceptor's generic toasts stay out of the way — it would say
 * "Access Denied: you don't have permission" for a mistyped code, "Not
 * Found: the link may be incorrect" for an unknown email, and nothing at all
 * for a rate limit.
 */
export function authErrorText(err: unknown): IAuthErrorText {
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  const raw: unknown =
    err instanceof HttpErrorResponse
      ? (err.error as { message?: unknown } | null)?.message
      : undefined;
  const serverMessage = Array.isArray(raw)
    ? String(raw[0] ?? '')
    : typeof raw === 'string'
      ? raw
      : '';

  if (status === 0) {
    return {
      title: 'No connection',
      message:
        "We couldn't reach Acheva. Check your internet connection and try again.",
    };
  }
  if (status === 429) {
    return {
      title: 'Too many attempts',
      message: 'Please wait a minute, then try again.',
    };
  }
  if (status === 403 && /token/i.test(serverMessage)) {
    return {
      title: 'Code not accepted',
      message:
        'That code is wrong, has expired or has already been used. Request a new code and try again.',
    };
  }
  if (status >= 500) {
    return {
      title: 'Something went wrong',
      message:
        'Something went wrong on our side. Please try again in a moment.',
    };
  }
  const message = serverMessage
    ? serverMessage.charAt(0).toUpperCase() + serverMessage.slice(1)
    : 'Please check what you entered and try again.';
  return { title: 'Could not continue', message };
}
