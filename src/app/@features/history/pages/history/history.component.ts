import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { PageEvent } from '@angular/material/paginator';
import { catchError, EMPTY } from 'rxjs';

import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { SkeletonTableComponent } from '../../../../@shared/components/skeleton/skeleton-table.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { IPaginator } from '../../../../@core/models/paginator.model';

import { HistoryPreviewComponent } from '../../components/history-preview/history-preview.component';
import {
  HistoryKind,
  IHistoryItem,
  IHistoryQuery,
} from '../../models/history.model';
import { HistoryService } from '../../services/history.service';
import { historyBadge } from '../../utils/history-status';

const PAGE_SIZE = 15;

@Component({
  selector: 'app-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    SearchInputComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    SvgComponent,
    MatDatepickerModule,
    ButtonComponent,
    MatTableModule,
    StatusBadgeComponent,
    MatDialogModule,
    ReactiveFormsModule,
    EmptyStateComponent,
    PaginatorComponent,
    SkeletonTableComponent,
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly historyService = inject(HistoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly displayedColumns: readonly string[] = [
    'courseCode',
    'date',
    'session',
    'semester',
    'status',
  ];

  readonly dataSource = signal<IHistoryItem[]>([]);
  readonly loading = signal<boolean>(true);
  readonly paginator = signal<IPaginator>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
  });

  /**
   * The single "Filter" dropdown narrows the feed to one workflow. History is
   * the only place the result chain and the moderation chain sit side by side,
   * so which chain a row came from is the axis worth filtering on.
   */
  readonly kinds = [
    { value: '', label: 'All activity' },
    { value: HistoryKind.RESULT, label: 'Results' },
    { value: HistoryKind.MODERATION, label: 'Moderations' },
  ];

  readonly filters = new FormGroup({
    kind: new FormControl<HistoryKind | ''>(''),
    startDate: new FormControl<Date | null>(null),
    endDate: new FormControl<Date | null>(null),
  });

  /** Kept out of the form group — it is debounced by the search component. */
  private search = '';

  readonly today = new Date();

  ngOnInit(): void {
    this.fetchHistory();
  }

  onSearch(term: string): void {
    this.search = term?.trim() ?? '';
    this.goToFirstPageAndFetch();
  }

  onKindChange(): void {
    this.goToFirstPageAndFetch();
  }

  applyDateFilters(): void {
    this.goToFirstPageAndFetch();
  }

  clearDateFilters(): void {
    this.filters.patchValue({ startDate: null, endDate: null });
    this.goToFirstPageAndFetch();
  }

  onPageChange(event: PageEvent): void {
    this.paginator.update((current) => ({
      ...current,
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    }));
    this.fetchHistory();
  }

  previewHistory(row: IHistoryItem): void {
    this.dialog.open(HistoryPreviewComponent, {
      width: '600px',
      // No `position` and no fixed `height`: Material centres the dialog, and
      // letting it size to its content stops a short preview from rendering as
      // a tall box of empty space.
      maxWidth: '92vw',
      maxHeight: '85vh',
      data: { kind: row.kind, id: row.id },
      panelClass: 'history-preview-panel',
    });
  }

  /** Row badge — the viewer's own action, or where the document sits. */
  badge(row: IHistoryItem) {
    return historyBadge(row);
  }

  trackById(_index: number, row: IHistoryItem): string {
    return `${row.kind}:${row.id}`;
  }

  get hasDateFilter(): boolean {
    const { startDate, endDate } = this.filters.getRawValue();
    return Boolean(startDate || endDate);
  }

  private goToFirstPageAndFetch(): void {
    this.paginator.update((current) => ({ ...current, page: 1 }));
    this.fetchHistory();
  }

  private fetchHistory(): void {
    this.loading.set(true);

    this.historyService
      .getHistory(this.buildQuery())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        // The global error interceptor already raises the toast; this only
        // has to stop the spinner and clear the stale page.
        catchError(() => {
          this.loading.set(false);
          this.dataSource.set([]);
          return EMPTY;
        })
      )
      .subscribe((response) => {
        const page = response.data;
        this.dataSource.set([...page.data]);
        this.paginator.set({
          page: page.page,
          pageSize: page.limit,
          total: page.total,
        });
        this.loading.set(false);
      });
  }

  private buildQuery(): IHistoryQuery {
    const { kind, startDate, endDate } = this.filters.getRawValue();
    const { page, pageSize } = this.paginator();

    return {
      page,
      limit: pageSize,
      ...(this.search ? { search: this.search } : {}),
      ...(kind ? { kind } : {}),
      ...(startDate ? { startDate: toApiDate(startDate) } : {}),
      ...(endDate ? { endDate: toApiDate(endDate) } : {}),
    };
  }
}

/**
 * `yyyy-MM-dd` from the picker's LOCAL date. `toISOString()` would shift the
 * day backwards for anyone west of UTC and silently drop a day's rows.
 */
function toApiDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
