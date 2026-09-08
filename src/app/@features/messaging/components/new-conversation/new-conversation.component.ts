import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatDialogRef } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { SkeletonComponent } from '../../../../@shared/components/skeleton/skeleton.component';
import {
  IDirectoryGroup,
  IDirectoryPerson,
} from '../../models/messaging.model';
import { MessagingService } from '../../services/messaging.service';

type Audience = 'STAFF' | 'STUDENTS';

/** Long enough that a stray keystroke does not cost a request. */
const SEARCH_DEBOUNCE_MS = 280;

/**
 * Pick somebody to write to.
 *
 * Two steps, as WhatsApp does it: choose the kind of person, then the person.
 * Splitting it keeps each list short enough to scan — a single list of every
 * colleague and every student would need searching before it could be used,
 * which defeats the point of a picker.
 *
 * The two lists search differently, on purpose. Students are one cohort, small
 * and already in hand, so they filter locally as you type. Staff are the whole
 * school: the default list is your own department because that is who you write
 * to daily, but the SEARCH goes to the server and reaches every department and
 * faculty — which is what the permission rule has always allowed.
 */
@Component({
  selector: 'app-new-conversation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  templateUrl: './new-conversation.component.html',
  styleUrl: './new-conversation.component.scss',
})
export class NewConversationComponent {
  private readonly dialogRef =
    inject<MatDialogRef<NewConversationComponent, IDirectoryPerson | null>>(
      MatDialogRef
    );
  private readonly messaging = inject(MessagingService);
  private readonly destroyRef = inject(DestroyRef);

  /** Null while the audience is still being chosen. */
  readonly audience = signal<Audience | null>(null);
  readonly groups = signal<IDirectoryGroup[]>([]);
  readonly unavailable = signal<string | null>(null);
  /** The first load of a list — the one that earns skeletons. */
  readonly loading = signal(false);
  /** A re-search over a list already on screen. Never blanks what is shown. */
  readonly refreshing = signal(false);
  readonly search = signal('');

  readonly title = computed(() => {
    if (this.audience() === 'STAFF') return 'Choose a colleague';
    if (this.audience() === 'STUDENTS') return 'Choose a student';
    return 'New message';
  });

  /**
   * What the list shows.
   *
   * Staff come back already matched by the server, so filtering them again
   * here would only risk dropping a row the server matched on a field this
   * component cannot see — an office found by its email address, for one.
   * Students are filtered locally: their cohort arrives whole and a request
   * per keystroke would be slower and would flicker.
   */
  readonly filtered = computed<IDirectoryGroup[]>(() => {
    if (this.audience() === 'STAFF') return this.groups();

    const term = this.search().trim().toLowerCase();
    if (!term) return this.groups();

    return this.groups()
      .map((group) => ({
        ...group,
        people: group.people.filter(
          (person) =>
            person.name.toLowerCase().includes(term) ||
            (person.email ?? '').toLowerCase().includes(term) ||
            (person.subtitle ?? '').toLowerCase().includes(term)
        ),
      }))
      .filter((group) => group.people.length > 0);
  });

  readonly isEmpty = computed(
    () => !this.loading() && !this.refreshing() && this.filtered().length === 0
  );

  constructor() {
    // Staff search is server-side, so it is debounced rather than fired per
    // keystroke. The audience guard matters: this stream emits its current
    // value on subscribe, before anyone has chosen a list to search.
    toObservable(this.search)
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((term) => term.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((term) => {
        if (this.audience() !== 'STAFF') return;
        this.load('STAFF', term, { keepList: true });
      });
  }

  choose(audience: Audience): void {
    this.audience.set(audience);
    this.search.set('');
    this.load(audience, '', { keepList: false });
  }

  private load(
    audience: Audience,
    term: string,
    options: { keepList: boolean }
  ): void {
    if (options.keepList) this.refreshing.set(true);
    else {
      this.loading.set(true);
      this.groups.set([]);
    }
    this.unavailable.set(null);

    this.messaging
      .directory(audience, term)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.groups.set([...resp.data.groups]);
          this.unavailable.set(resp.data.unavailableReason);
          this.loading.set(false);
          this.refreshing.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.refreshing.set(false);
          this.unavailable.set(
            'That list could not be loaded. Please try again.'
          );
        },
      });
  }

  /** Step back to the audience choice without closing the dialog. */
  back(): void {
    this.audience.set(null);
    this.search.set('');
    this.groups.set([]);
    this.unavailable.set(null);
  }

  pick(person: IDirectoryPerson): void {
    this.dialogRef.close(person);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  trackById = (_: number, item: { id: string }) => item.id;
  trackByLabel = (_: number, item: { label: string }) => item.label;

  initials(person: IDirectoryPerson): string {
    return person.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
