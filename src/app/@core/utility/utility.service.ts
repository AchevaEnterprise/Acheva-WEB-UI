import { Injectable, signal } from '@angular/core';
import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';

interface ExcelJsonResult {
  columns: string[];
  records: Record<string, unknown>[];
}

@Injectable({
  providedIn: 'root',
})
export class UtilityService {
  loadingGlobal = signal<boolean>(false);

  showLoader() {
    this.loadingGlobal.set(true);
  }

  hideLoader() {
    this.loadingGlobal.set(false);
  }

  formatCount(count: number) {
    return count > 10 ? '10+' : count.toString();
  }

  exportToExcel(jsonData: any[], fileName: string): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(jsonData);

    const workbook: XLSX.WorkBook = {
      Sheets: { data: worksheet },
      SheetNames: ['data'],
    };

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    }) as ArrayBuffer;

    const blob: Blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    FileSaver.saveAs(blob, `${fileName}.xlsx`);
  }

  generateSchoolSessions() {
    const currentYear = new Date().getFullYear();
    const startYear = 2000;
    const sessions = [];

    for (let year = startYear; year <= currentYear; year++) {
      const session = `${year}/${year + 1}`;
      sessions.push(session);
    }

    return sessions.reverse();
  }

  generateAdmissionYear() {
    const currentYear = new Date().getFullYear();
    const startYear = 2000;
    const admissionYear = [];

    for (let year = startYear; year <= currentYear; year++) {
      const session = `${year}`;
      admissionYear.push(session);
    }

    return admissionYear.reverse();
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[_-]+/g, ' ')
      .replace(/\s+(\w)/g, (_, c: string) => c.toUpperCase())
      .replace(/\s+/g, '')
      .replace(/^\w/, (c: string) => c.toLowerCase());
  }

  convertExcelToJson(file: File): Promise<ExcelJsonResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        const result = e.target?.result;

        if (typeof result !== 'string') {
          reject(new Error('Invalid file format'));
          return;
        }

        const workbook = XLSX.read(result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          { raw: true }
        );

        if (jsonData.length > 0) {
          const records = jsonData.map((row) => {
            const transformed: Record<string, unknown> = {};

            for (const key of Object.keys(row)) {
              const camelKey = this.toCamelCase(key);
              transformed[camelKey] = row[key];
            }

            return transformed;
          });

          const columns = Object.keys(records[0]);

          resolve({ columns, records });
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  }
}
