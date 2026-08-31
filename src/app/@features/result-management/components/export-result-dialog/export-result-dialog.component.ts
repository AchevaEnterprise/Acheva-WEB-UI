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
import { catchError, EMPTY, firstValueFrom } from 'rxjs';

import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SkeletonComponent } from '../../../../@shared/components/skeleton/skeleton.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ToastService } from '../../../../@core/utility/toast.service';
import { IIssuedDocument, IResultSheet } from '../../models/result-sheet.model';
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
  /** Set once a copy has been taken away, so the drawer can show its serial. */
  readonly issued = signal<IIssuedDocument | null>(null);

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

  /**
   * Mint a serial, then build the file around it.
   *
   * Minted HERE rather than when the drawer opened, so a serial only ever
   * exists for a copy that was actually taken away. The preview above therefore
   * cannot show it — which is why the preview is re-rendered afterwards, so
   * what is on screen ends up matching what was downloaded.
   */
  async download(format: 'PDF' | 'EXCEL'): Promise<void> {
    if (!this.sheet() || this.downloading()) return;

    this.downloading.set(format);
    try {
      const response = await firstValueFrom(
        this.exportService.issue(this.data.resultId)
      );
      const document = response.data;

      const provenance = {
        serial: document.serial,
        verifyUrl: document.verifyUrl,
        qrDataUrl: await this.exportService.qrDataUrl(document.verifyUrl),
      };

      // Rendered from the snapshot the server recorded, not the sheet fetched
      // when the drawer opened — the serial must vouch for exactly these
      // figures, and the two could differ if the result changed in between.
      if (format === 'PDF') {
        await this.exportService.downloadPdf(document.sheet, provenance);
      } else {
        await this.exportService.downloadExcel(document.sheet, provenance);
      }

      this.issued.set(document);
      this.sheet.set(document.sheet);
      await this.refreshPreview(document.sheet, provenance);
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

  /** Swap the preview for one carrying the serial and QR just issued. */
  private async refreshPreview(
    sheet: IResultSheet,
    provenance: { serial: string; verifyUrl: string; qrDataUrl: string }
  ): Promise<void> {
    try {
      const next = await this.exportService.previewUrl(sheet, provenance);
      if (this.rawPreviewUrl) URL.revokeObjectURL(this.rawPreviewUrl);
      this.rawPreviewUrl = next;
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(next));
    } catch {
      // The file is already downloaded; a stale preview is not worth an error.
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    if (this.rawPreviewUrl) URL.revokeObjectURL(this.rawPreviewUrl);
  }
}
