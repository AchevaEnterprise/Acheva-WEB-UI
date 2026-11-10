import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, finalize } from 'rxjs';

import { ToastService } from '../../../@core/utility/toast.service';
import { EmptyStateComponent } from '../../../@shared/components/empty-state/empty-state.component';
import { PaginatorComponent } from '../../../@shared/components/paginator/paginator.component';
import { SkeletonTableComponent } from '../../../@shared/components/skeleton/skeleton-table.component';
import { formatNaira } from '../../user-settings/utils/naira';
import {
  ISchoolFeeList,
  ISchoolFeeStudentRow,
  SchoolFeeStatus,
} from '../models/school-fees.model';
import { SchoolFeesService } from '../services/school-fees.service';
import { SchoolFeeReceiptsDialogComponent } from './receipts-dialog.component';

const STATUS_LABEL: Record<SchoolFeeStatus, string> = {
  PAID: 'Paid in full',
  PARTIAL: 'Part paid',
  NOT_STARTED: 'Not started',
  OPTION_REQUIRED: 'No option chosen',
  NO_FEE: 'No fee set',
};

/**
 * School Fees — who has paid (2026-11-09).
 *
 * For the Head of Department (their whole department) and a Course Advisor
 * (their own students), so they can remind the ones who have not — the user
 * asked for it so an advisor "can verbally remind his students". Nothing
 * here takes money or changes a fee; Acheva sets those.
 *
 * The counts across the top are the whole list, whatever the filters; they
 * double as the status filter, since "who has not started?" is the question
 * this page is opened to answer.
 */
@Component({
  selector: 'app-school-fees',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe,
    RouterLink,
    EmptyStateComponent,
    PaginatorComponent,
    SkeletonTableComponent,
  ],
  templateUrl: './school-fees.component.html',
  styleUrl: './school-fees.component.scss',
})
export class SchoolFeesComponent implements OnInit {
  private readonly api = inject(SchoolFeesService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  /** The server has no school-fees list to give (a 404) — said on the page, not in a toast. */
  readonly unavailable = signal(false);
  readonly list = signal<ISchoolFeeList | null>(null);

  readonly status = signal<SchoolFeeStatus | ''>('');
  readonly level = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(25);
  private readonly typed = new Subject<string>();

  readonly summary = computed(() => this.list()?.summary ?? null);
  readonly rows = computed(() => this.list()?.data ?? []);
  readonly isAdvisor = computed(() => this.list()?.scope === 'ADVISOR');
  readonly paginator = computed(() => ({
    page: this.page(),
    pageSize: this.pageSize(),
    total: this.list()?.total ?? 0,
  }));

  /** The status tiles — they filter the table. */
  readonly tiles = computed(() => {
    const summary = this.summary();
    if (!summary) return [];
    return [
      { status: '' as const, label: 'All students', count: summary.students },
      { status: 'PAID' as const, label: 'Paid in full', count: summary.paid },
      {
        status: 'PARTIAL' as const,
        label: 'Part paid',
        count: summary.partial,
      },
      {
        status: 'NOT_STARTED' as const,
        label: 'Not started',
        count: summary.notStarted,
      },
    ];
  });

  ngOnInit(): void {
    this.typed
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.search.set(term);
        this.page.set(1);
        this.load();
      });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .students({
        status: this.status(),
        level: this.level(),
        search: this.search().trim(),
        page: this.page(),
        limit: this.pageSize(),
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (resp) => {
          this.unavailable.set(false);
          this.list.set(resp.data);
        },
        error: (err) => {
          // Nothing there is not an error the user made (2026-11-10).
          if (err?.status === 404) {
            this.unavailable.set(true);
            return;
          }
          this.toast.showNotification(
            'error',
            'Could not load school fees',
            err?.error?.message ?? 'Please try again.'
          );
        },
      });
  }

  chooseStatus(status: SchoolFeeStatus | ''): void {
    this.status.set(status);
    this.page.set(1);
    this.load();
  }

  chooseLevel(level: string): void {
    this.level.set(level);
    this.page.set(1);
    this.load();
  }

  onSearch(event: Event): void {
    this.typed.next((event.target as HTMLInputElement).value);
  }

  onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  /** Receipts counted toward this student's fees that nobody has checked. */
  unchecked(row: ISchoolFeeStudentRow): number {
    return row.receipts.filter((receipt) => receipt.status === 'UNCHECKED')
      .length;
  }

  openReceipts(row: ISchoolFeeStudentRow): void {
    this.dialog.open(SchoolFeeReceiptsDialogComponent, {
      data: row,
      width: '640px',
      maxWidth: '92vw',
    });
  }

  statusLabel(row: ISchoolFeeStudentRow): string {
    return STATUS_LABEL[row.status];
  }

  money(kobo: number | null): string {
    return kobo === null ? '—' : formatNaira(kobo);
  }

  /** "15/01/2027" — day first, fixed for a Nigerian product. */
  date(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getUTCFullYear()}`;
  }
}
