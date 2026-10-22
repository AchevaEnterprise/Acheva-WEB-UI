import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { IAnalytics } from '../../../../@core/models/school.model';
import { IPaginator } from '../../../../@core/models/paginator.model';
import { ToastService } from '../../../../@core/utility/toast.service';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { formatNaira } from '../../../user-settings/utils/naira';
import { DueAnalyticsComponent } from '../../components/due-analytics/due-analytics.component';
import {
  DuesStandingStatus,
  IDuesCollectionRow,
  IDuesCollectionsPage,
} from '../../models/collections.model';
import { DuesCollectionsService } from '../../services/dues-collections.service';

/** `ALL` is a view, not a level — kept out of the level union deliberately. */
type LevelFilter = string;

@Component({
  selector: 'app-dues-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DueAnalyticsComponent,
    PaginatorComponent,
    MatTableModule,
    DatePipe,
  ],
  templateUrl: './dues-management.component.html',
  styleUrl: './dues-management.component.scss',
})
export class DuesManagementComponent implements OnInit {
  private readonly api = inject(DuesCollectionsService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchTerm$ = new Subject<string>();

  readonly loading = signal(true);
  readonly page = signal<IDuesCollectionsPage | null>(null);
  readonly level = signal<LevelFilter>('ALL');
  readonly status = signal<DuesStandingStatus | 'ALL'>('ALL');
  readonly search = signal('');
  readonly pageIndex = signal(1);

  /** Which student's payment breakdown is open. One at a time. */
  readonly expanded = signal<string | null>(null);

  readonly plan = computed(() => this.page()?.plan ?? null);
  readonly summary = computed(() => this.page()?.summary ?? null);
  readonly rows = computed(() => this.page()?.rows ?? []);
  readonly hasPlan = computed(() => this.plan() !== null);

  /**
   * "All" first, then the levels the cohort actually contains.
   *
   * Taken from the roster rather than from the Level enum: offering 600L on
   * a four-year programme invites a Head to filter to an empty table and
   * conclude the page is broken.
   */
  readonly levels = computed<LevelFilter[]>(() => [
    'ALL',
    ...(this.page()?.levels ?? []),
  ]);

  readonly statuses: { label: string; value: DuesStandingStatus | 'ALL' }[] = [
    { label: 'Everyone', value: 'ALL' },
    { label: 'Paid in full', value: 'PAID' },
    { label: 'Part paid', value: 'PARTIAL' },
    { label: 'Not started', value: 'NOT_STARTED' },
  ];

  readonly paginator = computed<IPaginator>(() => ({
    page: this.page()?.page ?? 1,
    pageSize: this.page()?.limit ?? 50,
    total: this.page()?.total ?? 0,
  }));

  /**
   * The four figures a Head opens this page for. Collected against expected
   * is the one that answers "how are we doing"; the counts answer "who do I
   * chase".
   */
  readonly analytics = computed<Partial<IAnalytics>[]>(() => {
    const summary = this.summary();
    if (!summary) return [];

    return [
      {
        label: 'Collected',
        count: formatNaira(summary.collectedKobo) as unknown as number,
        // NOT `dash-card-verified`, which is the only green icon in the set
        // and green is off-brand here. Navy is the nearest to #2793FF the
        // existing icons offer, and "published" reads as money settled.
        iconSrc: 'images/general/dash-card-published.svg',
        infoLabel: `Out of ${formatNaira(summary.expectedKobo)} if everyone settles`,
      },
      {
        label: 'Paid in full',
        count: summary.paid,
        iconSrc: 'images/general/dash-card-draft.svg',
        infoLabel: `of ${summary.students} students who owe this plan`,
      },
      {
        label: 'Part paid',
        count: summary.partial,
        iconSrc: 'images/general/dash-card-unverified.svg',
        infoLabel: 'Started paying but still owe a balance',
      },
      {
        label: 'Not started',
        count: summary.notStarted,
        // The red one, because this is the group a Head opens the page to
        // chase — amber for in-progress, red for nothing paid at all.
        iconSrc: 'images/general/dash-card-pending.svg',
        infoLabel: 'Have paid nothing towards this plan',
      },
    ];
  });

  readonly displayedColumns = [
    'student',
    'level',
    'paid',
    'outstanding',
    'payments',
    'lastPaid',
    'status',
  ];

  ngOnInit(): void {
    this.searchTerm$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((term) => {
        this.search.set(term);
        this.pageIndex.set(1);
        this.load();
      });

    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .collections({
        level: this.level() === 'ALL' ? undefined : this.level(),
        status:
          this.status() === 'ALL'
            ? undefined
            : (this.status() as DuesStandingStatus),
        search: this.search() || undefined,
        page: this.pageIndex(),
        limit: 50,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.page.set(resp.data);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.showNotification(
            'error',
            'Could not load dues collections',
            err?.error?.message ?? 'Please try again.'
          );
        },
      });
  }

  selectLevel(value: LevelFilter): void {
    if (value === this.level()) return;
    this.level.set(value);
    this.pageIndex.set(1);
    this.load();
  }

  selectStatus(value: DuesStandingStatus | 'ALL'): void {
    if (value === this.status()) return;
    this.status.set(value);
    this.pageIndex.set(1);
    this.load();
  }

  onSearch(term: string): void {
    this.searchTerm$.next(term.trim());
  }

  changePage(event: { pageIndex: number }): void {
    this.pageIndex.set(event.pageIndex + 1);
    this.load();
  }

  /** Open or close one student's payment breakdown. */
  toggleRow(row: IDuesCollectionRow): void {
    if (row.paymentsMade === 0) return;
    this.expanded.update((open) =>
      open === row.studentId ? null : row.studentId
    );
  }

  isExpanded(row: IDuesCollectionRow): boolean {
    return this.expanded() === row.studentId;
  }

  money(kobo: number): string {
    return formatNaira(kobo);
  }

  levelLabel(value: LevelFilter): string {
    return value === 'ALL' ? 'All levels' : `${value}L`;
  }

  statusLabel(status: DuesStandingStatus): string {
    if (status === 'PAID') return 'Paid';
    if (status === 'PARTIAL') return 'Part paid';
    return 'Not started';
  }

  /**
   * Three tones, and none of them green — green is off-brand here. "Paid" is
   * the brand blue, which is also what the History badge uses for a positive
   * verdict.
   */
  statusTone(status: DuesStandingStatus): 'paid' | 'partial' | 'none' {
    if (status === 'PAID') return 'paid';
    if (status === 'PARTIAL') return 'partial';
    return 'none';
  }

  /** "2 payments" / "1 payment" / "—". */
  paymentsLabel(row: IDuesCollectionRow): string {
    if (row.paymentsMade === 0) return '—';
    return `${row.paymentsMade} ${row.paymentsMade === 1 ? 'payment' : 'payments'}`;
  }

  trackRow(_: number, row: IDuesCollectionRow): string {
    return row.studentId;
  }
}
