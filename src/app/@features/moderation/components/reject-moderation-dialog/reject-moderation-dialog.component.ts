import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { IRejectPayload } from '../../models/moderation.model';

interface RejectDialogData {
  title: string;
  description: string;
  /** Label of the destructive button (defaults to "Reject"). */
  confirmLabel?: string;
}

/**
 * Captures a `reason` (required, non-blank) and an optional `comment` for any
 * moderation rejection endpoint. Closes with the {@link IRejectPayload} on
 * confirm or `null` on cancel.
 */
@Component({
  selector: 'app-reject-moderation-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    ButtonComponent,
  ],
  templateUrl: './reject-moderation-dialog.component.html',
  styleUrl: './reject-moderation-dialog.component.scss',
})
export class RejectModerationDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<RejectModerationDialogComponent, IRejectPayload | null>
  );
  readonly data = inject<RejectDialogData>(MAT_DIALOG_DATA);

  form = new FormGroup({
    reason: new FormControl<string>('', {
      nonNullable: true,
      validators: [nonBlankRequired, Validators.maxLength(2000)],
    }),
    comment: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  cancel(): void {
    this.dialogRef.close(null);
  }

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { reason, comment } = this.form.getRawValue();
    this.dialogRef.close({
      reason: reason.trim(),
      comment: comment.trim() || undefined,
    });
  }
}

/** `Validators.required` accepts whitespace; rejection reasons must have body. */
const nonBlankRequired: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const v: unknown = control.value;
  if (typeof v !== 'string' || v.trim().length === 0) {
    return { required: true };
  }
  return null;
};
