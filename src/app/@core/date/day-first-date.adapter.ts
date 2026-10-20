import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/** `15/11/2026`, `15-11-2026`, `15.11.2026` — day first, four-digit year. */
const DAY_FIRST = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/;

/**
 * A Material date adapter that READS dates day-first.
 *
 * `MAT_DATE_LOCALE` is not enough on its own, which is the trap here: it
 * changes how a date is DISPLAYED, while `NativeDateAdapter.parse` still calls
 * `Date.parse`. `Date.parse('15/11/2026')` is `NaN` in V8, so a Head typing a
 * due date the way every Nigerian writes one gets an "invalid date" they
 * cannot explain — and, worse, `05/06/2026` parses happily as the 6th of May
 * instead of the 5th of June. A silently wrong due date on a payment schedule
 * is the failure that matters.
 *
 * Only `parse` is overridden. Display already comes out `dd/mm/yyyy` from the
 * `en-GB` locale, and re-implementing formatting would be a second thing to
 * keep in step.
 */
@Injectable()
export class DayFirstDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (typeof value === 'number') return new Date(value);
    if (typeof value !== 'string' || !value.trim()) return null;

    const match = DAY_FIRST.exec(value.trim());
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      const date = new Date(year, month - 1, day);

      // `new Date(2026, 1, 31)` silently rolls into March. A date that did not
      // survive the round trip was never a real date, so reject it rather
      // than accept a day the user did not type.
      const survived =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;

      return survived ? date : null;
    }

    // Anything else (an ISO string from the picker itself, say) keeps the
    // base behaviour — unambiguous formats need no help.
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
}
