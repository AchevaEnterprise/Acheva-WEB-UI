import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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

  commentCtrl: FormControl = new FormControl('');

  cancel() {
    this.dialogRef.close();
  }

  confrim() {
    this.dialogRef.close(this.commentCtrl.value);
  }
}
