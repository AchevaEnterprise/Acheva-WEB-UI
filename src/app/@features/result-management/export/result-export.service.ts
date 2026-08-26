import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IResultSheet } from '../models/result-sheet.model';
import { ResultsService } from '../services/results.service';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import { buildResultSheetPdf } from './result-sheet-pdf';
import {
  applySheetColumnWidths,
  buildResultSheetRows,
  sheetName,
} from './result-sheet-excel';
import { sheetFileName } from './result-sheet-columns';

/**
 * Turns one result sheet into the two files a lecturer can take away.
 *
 * pdfmake and xlsx are both heavy and neither is needed until someone actually
 * exports, so both load through a dynamic `import()` inside the method that
 * uses them — the pattern the repo already uses for Excel and Highcharts.
 */
@Injectable({ providedIn: 'root' })
export class ResultExportService {
  private readonly resultsService = inject(ResultsService);

  /** pdfmake, initialised once per session. */
  private pdfMake: Promise<PdfMakeStatic> | null = null;

  getSheet(resultId: string): Observable<IAPIResponse<IResultSheet>> {
    return this.resultsService.getResultSheet(resultId);
  }

  /**
   * A blob URL of the PDF, for the preview iframe.
   *
   * The preview renders the very file the download produces — not an HTML
   * lookalike. A separate preview layout would be a second definition of the
   * document, free to drift from the one that actually gets printed.
   */
  async previewUrl(sheet: IResultSheet): Promise<string> {
    const pdf = await this.createPdf(sheet);
    // pdfmake 0.3 returns a Promise from getBlob; 0.2 took a callback. The
    // callback form fails silently here — the download still worked, so only
    // the preview was blank.
    const blob = await pdf.getBlob();
    return URL.createObjectURL(blob);
  }

  async downloadPdf(sheet: IResultSheet): Promise<void> {
    const pdf = await this.createPdf(sheet);
    pdf.download(`${sheetFileName(sheet)}.pdf`);
  }

  async downloadExcel(sheet: IResultSheet): Promise<void> {
    const XLSX = await import('xlsx');
    const { saveAs } = await import('file-saver');

    const worksheet = XLSX.utils.aoa_to_sheet(
      buildResultSheetRows(sheet) as unknown[][]
    );
    applySheetColumnWidths(worksheet);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName(sheet));

    // `XLSX.write` is typed `any`; with `type: 'array'` it returns an
    // ArrayBuffer, so the shape is asserted here rather than left unsafe.
    const buffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    }) as ArrayBuffer;
    saveAs(
      new Blob([buffer], { type: 'application/octet-stream' }),
      `${sheetFileName(sheet)}.xlsx`
    );
  }

  private async createPdf(sheet: IResultSheet): Promise<PdfDocument> {
    const pdfMake = await this.loadPdfMake();
    return pdfMake.createPdf(buildResultSheetPdf(sheet));
  }

  private loadPdfMake(): Promise<PdfMakeStatic> {
    // Cached: the font file is ~1MB and re-registering it on every export
    // would re-parse it each time.
    this.pdfMake ??= (async () => {
      const [pdfMakeModule, vfsModule] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts'),
      ]);

      const pdfMake = (pdfMakeModule.default ??
        pdfMakeModule) as unknown as PdfMakeStatic;
      const vfs = (vfsModule as { default?: unknown }).default ?? vfsModule;
      pdfMake.addVirtualFileSystem(vfs);
      return pdfMake;
    })();

    return this.pdfMake;
  }
}

/** The slice of pdfmake's surface this service uses. */
interface PdfMakeStatic {
  addVirtualFileSystem(vfs: unknown): void;
  createPdf(definition: Record<string, unknown>): PdfDocument;
}

interface PdfDocument {
  getBlob(): Promise<Blob>;
  download(fileName: string): void;
}
