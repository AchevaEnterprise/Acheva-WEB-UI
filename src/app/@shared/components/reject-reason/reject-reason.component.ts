import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { ButtonComponent } from '../forms/button/button.component';
import { CommentComponent } from '../forms/comment/comment.component';

@Component({
  selector: 'app-reject-reason',
  imports: [
    MatDialogModule,
    CommentComponent,
    ButtonComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './reject-reason.component.html',
  styleUrl: './reject-reason.component.scss',
})
export class RejectReasonComponent {
  private readonly dialogRef = inject(MatDialogRef<RejectReasonComponent>);
  readonly data = inject<{
    resultId: string;
  }>(MAT_DIALOG_DATA);

  commentCtrl: FormControl = new FormControl('');

  /**
   * A rejection needs a reason the recipient can act on. Every caller treats
   * an empty value as "cancelled", so Confirm with nothing typed used to close
   * the dialog and silently do nothing. Signal mirror of the control (a
   * FormControl is not a signal) so the button can track it.
   */
  readonly hasReason = signal(false);

  constructor() {
    this.commentCtrl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value: unknown) =>
        this.hasReason.set(String(value ?? '').trim().length > 0)
      );
  }

  cancel() {
    this.dialogRef.close();
  }

  confrim() {
    const reason = String(this.commentCtrl.value ?? '').trim();
    if (!reason) return;
    this.dialogRef.close(reason);
  }
}
