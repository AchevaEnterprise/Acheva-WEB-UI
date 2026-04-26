import { Component, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ToastService } from '../../../@core/utility/toast.service';
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
  private readonly toast = inject(ToastService);

  file = signal<File | null>(null);

  onFileSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files![0];
    this.file.set(file);
    this.toast.showNotification(
      'success',
      'File Selected',
      'File selected successfully'
    );
  }

  removeFile() {
    this.file.set(null);
  }

  cancel() {
    this.dialogRef.close();
  }

  confirm() {
    this.dialogRef.close(this.file());
  }
}
