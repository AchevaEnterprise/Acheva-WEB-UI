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

  convertExcelToJson(
    file: File
  ): Promise<{ columns: string[]; records: any[] }> {
    return new Promise((resolve, reject) => {
      const reader: FileReader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const data: string =
          e.target && typeof e.target.result === 'string'
            ? (e.target.result as string)
            : '';
        const workbook: XLSX.WorkBook = XLSX.read(data, {
          type: 'binary',
        });

        // Read first sheet
        const sheetName: string = workbook.SheetNames[0];
        const worksheet: XLSX.WorkSheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
          raw: true,
        });

        if (jsonData.length > 0) {
          const columns = Object.keys(jsonData[0]);
          const records = jsonData;
          resolve({ columns, records });
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  }
}
