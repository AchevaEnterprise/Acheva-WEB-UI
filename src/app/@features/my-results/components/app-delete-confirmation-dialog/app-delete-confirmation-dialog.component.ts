import { Component, inject, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';

export interface DeleteConfirmationData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  count?: number;
}

@Component({
  selector: 'app-delete-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatIconModule, ButtonComponent],
  templateUrl: './app-delete-confirmation-dialog.component.html',
  styleUrl: './app-delete-confirmation-dialog.component.scss',
})
export class DeleteConfirmationDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<DeleteConfirmationDialogComponent>
  );

  constructor(@Inject(MAT_DIALOG_DATA) public data: DeleteConfirmationData) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
