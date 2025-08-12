import { Component, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../forms/button/button.component';
import { SvgComponent } from '../svg/svg.component';

@Component({
  selector: 'app-upload-result-dialog',
  imports: [MatDialogModule, ButtonComponent, SvgComponent],
  templateUrl: './upload-result-dialog.component.html',
  styleUrl: './upload-result-dialog.component.scss',
})
export class UploadResultDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<UploadResultDialogComponent>
  );

  file = signal<File | null>(null);

  onFileSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files![0];
    this.file.set(file);
  }

  removeFile() {
    this.file.set(null);
  }

  cancel() {
    this.dialogRef.close();
  }

  confrim() {
    this.dialogRef.close(this.file());
  }
}
