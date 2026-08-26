import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, EMPTY } from 'rxjs';

import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SkeletonComponent } from '../../../../@shared/components/skeleton/skeleton.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ToastService } from '../../../../@core/utility/toast.service';
import { IResultSheet } from '../../models/result-sheet.model';
import { ResultExportService } from '../../export/result-export.service';

export interface IExportResultDialogData {
  readonly resultId: string;
}

@Component({
  selector: 'app-export-result-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, SkeletonComponent, SvgComponent],
  templateUrl: './export-result-dialog.component.html',
  styleUrl: './export-result-dialog.component.scss',
})
export class ExportResultDialogComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(
    MatDialogRef<ExportResultDialogComponent>
  );
  private readonly exportService = inject(ResultExportService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject<IExportResultDialogData>(MAT_DIALOG_DATA);

  readonly sheet = signal<IResultSheet | null>(null);
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly loading = signal<boolean>(true);
  readonly downloading = signal<'PDF' | 'EXCEL' | null>(null);

  /** Held so it can be revoked — a blob URL leaks until it is. */
  private rawPreviewUrl: string | null = null;

  ngOnInit(): void {
    this.exportService
      .getSheet(this.data.resultId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        // The global interceptor raises the toast; closing beats leaving an
        // empty dialog behind it.
        catchError(() => {
          this.loading.set(false);
          this.dialogRef.close();
          return EMPTY;
        })
      )
      .subscribe(async (response) => {
        const sheet = response.data;
        this.sheet.set(sheet);

        try {
          this.rawPreviewUrl = await this.exportService.previewUrl(sheet);
          this.previewUrl.set(
            this.sanitizer.bypassSecurityTrustResourceUrl(this.rawPreviewUrl)
          );
        } catch {
          this.toast.showNotification(
            'error',
            'Preview unavailable',
            'The sheet could not be rendered. You can still download it.'
          );
        } finally {
          this.loading.set(false);
        }
      });
  }

  async download(format: 'PDF' | 'EXCEL'): Promise<void> {
    const sheet = this.sheet();
    if (!sheet || this.downloading()) return;

    this.downloading.set(format);
    try {
      if (format === 'PDF') {
        await this.exportService.downloadPdf(sheet);
      } else {
        await this.exportService.downloadExcel(sheet);
      }
    } catch {
      this.toast.showNotification(
        'error',
        'Download failed',
        'The file could not be generated. Please try again.'
      );
    } finally {
      this.downloading.set(null);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    if (this.rawPreviewUrl) URL.revokeObjectURL(this.rawPreviewUrl);
  }
}
