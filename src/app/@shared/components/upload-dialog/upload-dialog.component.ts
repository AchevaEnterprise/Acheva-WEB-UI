import { Component, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { DragDropDirective } from '../../../@core/directives/drag-drop.directive';
import { ButtonComponent } from '../forms/button/button.component';
import { SvgComponent } from '../svg/svg.component';

@Component({
  selector: 'app-upload-dialog',
  imports: [MatDialogModule, ButtonComponent, SvgComponent, DragDropDirective],
  templateUrl: './upload-dialog.component.html',
  styleUrl: './upload-dialog.component.scss',
})
export class UploadDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<UploadDialogComponent>);
  private readonly data = inject(MAT_DIALOG_DATA) as {
    title: string;
    description: string;
  };

  title = this.data.title;
  description = this.data.description;
  isHovering = false;

  file = signal<File | null>(null);

  onFileSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files![0];
    this.file.set(file);
  }

  onFilesDropped(files: FileList) {
    const file = files[0];
    if (file) this.file.set(file);
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
