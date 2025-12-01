import { Injectable, signal } from '@angular/core';
import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';

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

  convertExcelToJson<T = Record<string, unknown>>(
    file: File
  ): Promise<{ columns: string[]; records: T[] }> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('../workers/excel.worker', import.meta.url)
      );

      const reader = new FileReader();
      reader.onload = (e) => {
        const binary = e.target?.result;
        if (typeof binary !== 'string') {
          reject(new Error('Invalid file data'));
          return;
        }

        worker.postMessage({ binary });
      };

      reader.readAsBinaryString(file);

      worker.onmessage = ({ data }) => {
        if (data.error) reject(data.error);
        else resolve(data);
        worker.terminate();
      };

      worker.onerror = (err) => {
        reject(err.message);
        worker.terminate();
      };
    });
  }
}
