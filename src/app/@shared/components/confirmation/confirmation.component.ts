import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { ButtonComponent } from '../forms/button/button.component';
import { SvgComponent } from '../svg/svg.component';

@Component({
  selector: 'app-confirmation',
  imports: [MatDialogModule, SvgComponent, ButtonComponent],
  templateUrl: './confirmation.component.html',
  styleUrl: './confirmation.component.scss',
})
export class ConfirmationComponent {
  private readonly dialogRef = inject(MatDialogRef<ConfirmationComponent>);
  public readonly data = inject<{ message: string; subTitle: string }>(
    MAT_DIALOG_DATA
  );

  cancel() {
    this.dialogRef.close(false);
  }

  confrim() {
    this.dialogRef.close(true);
  }
}
