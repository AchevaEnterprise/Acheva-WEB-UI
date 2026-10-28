import { HttpErrorResponse } from '@angular/common/http';

/**
 * Why a message did not send, in words that tell the sender what to do.
 *
 * Every failure used to read "check your connection" — including a message
 * over the 4,000-character limit and a sender who hit the rate limit, where
 * the connection was fine and retrying would fail the same way.
 *
 * Hand-kept copy in each app, like the rest of messaging.
 */
export function sendFailureText(err: unknown): string {
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  if (status === 429) {
    return 'You are sending messages too quickly. Wait a minute, then try again.';
  }
  if (status === 400) {
    return 'Messages can be up to 4,000 characters. Shorten it and try again.';
  }
  if (status === 403 || status === 404) {
    return 'You can no longer send messages in this conversation.';
  }
  if (status >= 500) {
    return 'Something went wrong on our side. Please try again in a moment.';
  }
  return 'That message did not go through. Check your connection and try again.';
}
