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
import { IExtraYearSet, ISetStudent } from '../../models/advising.model';
import { AdvisingService } from '../../services/advising.service';

/**
 * Extra Year — one list per finished set (2026-11-09).
 *
 * When a set an advisor saw through final year still has students owing
 * courses, those students stay with that advisor even after they take a new
 * set. Kept apart from the Students page so a career's worth of extra-year
 * students never crowds the set being advised now: "Extra year · 2018 set",
 * "Extra year · 2023 set", each on its own.
 */
@Component({
  selector: 'app-extra-year',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe,
    RouterLink,
    EmptyStateComponent,
    SkeletonTableComponent,
  ],
  templateUrl: './extra-year.component.html',
  styleUrl: '../advising.scss',
})
export class ExtraYearComponent implements OnInit {
  private readonly advising = inject(AdvisingService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly loadingStudents = signal(false);
  readonly sets = signal<readonly IExtraYearSet[]>([]);
  readonly selected = signal<string | null>(null);
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
          const sets = resp.data?.extraYear ?? [];
          this.sets.set(sets);
          const asked = this.route.snapshot.queryParamMap.get('set');
          const first =
            sets.find((set) => set.admissionYear === asked) ?? sets[0];
          if (first) this.choose(first.admissionYear);
        },
        error: (err) =>
          this.toast.showNotification(
            'error',
            'Could not load your sets',
            err?.error?.message ?? 'Please try again.'
          ),
      });
  }

  choose(admissionYear: string): void {
    this.selected.set(admissionYear);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { set: admissionYear },
      replaceUrl: true,
    });
    this.loadingStudents.set(true);
    this.advising
      .setStudents(admissionYear, 'extra-year')
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
