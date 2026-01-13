import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatRadioModule } from '@angular/material/radio';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { CommentComponent } from '../../../../@shared/components/forms/comment/comment.component';

@Component({
  selector: 'app-resend-to-dean',
  imports: [
    MatDialogModule,
    MatDividerModule,
    ButtonComponent,
    CommentComponent,
    ReactiveFormsModule,
    MatRadioModule,
  ],
  templateUrl: './resend-to-dean.component.html',
  styleUrl: './resend-to-dean.component.scss',
})
export class ResendToDeanComponent {
  private readonly dialogRef = inject(MatDialogRef<ResendToDeanComponent>);
  readonly data = inject<{
    resultId: string;
  }>(MAT_DIALOG_DATA);

  form = new FormGroup({
    issueStatus: new FormControl(''),
    comment: new FormControl(''),
  });

  cancel() {
    this.dialogRef.close();
  }

  confrim() {
    this.dialogRef.close(this.form.value);
  }
}
