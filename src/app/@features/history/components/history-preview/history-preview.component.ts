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
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { catchError, EMPTY } from 'rxjs';

import { ImageFallbackDirective } from '../../../../@core/directives/image-fallback.directive';
import { SkeletonComponent } from '../../../../@shared/components/skeleton/skeleton.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { HistoryKind, IHistoryDetail } from '../../models/history.model';
import { HistoryService } from '../../services/history.service';
import { actionedOnLabel } from '../../utils/history-status';

export interface IHistoryPreviewData {
  readonly kind: HistoryKind;
  readonly id: string;
}

/** Short role chips — the full enum names overflow the comment header. */
const ROLE_LABELS: Readonly<Record<string, string>> = {
  HOD: 'HOD',
  DEAN: 'Dean',
  COURSE_COORDINATOR: 'CC',
  COURSE_ADVISOR: 'CA',
  LECTURER: 'Lecturer',
};

@Component({
  selector: 'app-history-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, SvgComponent, ImageFallbackDirective, SkeletonComponent],
  templateUrl: './history-preview.component.html',
  styleUrl: './history-preview.component.scss',
})
export class HistoryPreviewComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<HistoryPreviewComponent>);
  private readonly historyService = inject(HistoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = inject<IHistoryPreviewData>(MAT_DIALOG_DATA);

  readonly detail = signal<IHistoryDetail | null>(null);
  readonly loading = signal<boolean>(true);

  readonly isModeration = this.data.kind === HistoryKind.MODERATION;

  ngOnInit(): void {
    this.historyService
      .getHistoryDetail(this.data.kind, this.data.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        // The global error interceptor raises the toast; closing the drawer
        // is better than leaving an empty shell behind it.
        catchError(() => {
          this.loading.set(false);
          this.dialogRef.close();
          return EMPTY;
        })
      )
      .subscribe((response) => {
        this.detail.set(response.data);
        this.loading.set(false);
      });
  }

  /** "Approved on" / "Rejected on" — the label follows the actual verdict. */
  get actionLabel(): string {
    return actionedOnLabel(this.detail()?.action ?? null);
  }

  /**
   * The date shown beside `actionLabel`. A row the viewer never acted on has no
   * `actionedOn`, so it falls back to the desk date — two em-dashes side by
   * side just reads as broken.
   */
  get actionDate(): string | null {
    const record = this.detail();
    if (!record) return null;
    return record.actionedOn ?? record.date ?? null;
  }

  roleLabel(role: string | null | undefined): string {
    if (!role) return '';
    return ROLE_LABELS[role] ?? role;
  }

  close(): void {
    this.dialogRef.close();
  }
}
