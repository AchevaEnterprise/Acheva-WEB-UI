import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { SkeletonTableComponent } from '../../../../@shared/components/skeleton/skeleton-table.component';
import {
  ICurrentSet,
  IPreviousSet,
  ISetStudent,
} from '../../models/advising.model';
import { AdvisingService } from '../../services/advising.service';

/** How each way of leaving a set reads. */
const OUTCOME: Readonly<Record<string, string>> = {
  SET_COMPLETED: 'Saw through final year',
  HANDED_OVER: 'Handed over',
  UNASSIGNED: 'Unassigned',
  REASSIGNED: 'Moved to another set',
};

/**
 * Previously Advised Sets — every set this advisor has held, for reference
 * (2026-11-09). An advisor follows a set for four or five years, so a career
 * is a handful of these; each opens to its students and their records.
 */
@Component({
  selector: 'app-advised-sets',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe,
    RouterLink,
    EmptyStateComponent,
    SkeletonTableComponent,
  ],
  templateUrl: './advised-sets.component.html',
  styleUrl: '../advising.scss',
})
export class AdvisedSetsComponent implements OnInit {
  private readonly advising = inject(AdvisingService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly loadingStudents = signal(false);
  readonly current = signal<ICurrentSet | null>(null);
  readonly previous = signal<readonly IPreviousSet[]>([]);
  readonly selected = signal<IPreviousSet | null>(null);
  readonly students = signal<readonly ISetStudent[]>([]);

  ngOnInit(): void {
    this.advising
      .mySets()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (resp) => {
          this.current.set(resp.data?.current ?? null);
          const previous = resp.data?.previous ?? [];
          this.previous.set(previous);
          const asked = this.route.snapshot.queryParamMap.get('set');
          const match = previous.find((set) => set.id === asked);
          if (match) this.open(match);
        },
        error: (err) =>
          this.toast.showNotification(
            'error',
            'Could not load your sets',
            err?.error?.message ?? 'Please try again.'
          ),
      });
  }

  outcome(set: IPreviousSet): string {
    return set.endedReason ? (OUTCOME[set.endedReason] ?? 'Ended') : 'Ended';
  }

  /** "100 → 500 Level · 2018/2019 – 2022/2023", with what is known. */
  span(set: IPreviousSet): string {
    const levels =
      set.startedLevel && set.endedLevel && set.startedLevel !== set.endedLevel
        ? `${set.startedLevel} → ${set.endedLevel} Level`
        : set.endedLevel
          ? `${set.endedLevel} Level`
          : '';
    const sessions = [set.startedSession, set.endedSession]
      .filter(Boolean)
      .join(' – ');
    return [levels, sessions].filter(Boolean).join(' · ');
  }

  open(set: IPreviousSet): void {
    this.selected.set(set);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { set: set.id },
      replaceUrl: true,
    });
    this.loadingStudents.set(true);
    this.advising
      .setStudents(set.admissionYear, 'all')
      .pipe(
        finalize(() => this.loadingStudents.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (resp) => this.students.set(resp.data?.students ?? []),
        error: (err) =>
          this.toast.showNotification(
            'error',
            'Could not load the set',
            err?.error?.message ?? 'Please try again.'
          ),
      });
  }
}
