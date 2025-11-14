import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { CommentComponent } from '../../../../@shared/components/forms/comment/comment.component';

@Component({
  selector: 'app-resend-to-course-coordinator',
  imports: [
    MatDialogModule,
    CommentComponent,
    ButtonComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './resend-to-course-coordinator.component.html',
  styleUrl: './resend-to-course-coordinator.component.scss',
})
export class ResendToCourseCoordinatorComponent {
  private readonly dialogRef = inject(
    MatDialogRef<ResendToCourseCoordinatorComponent>
  );

  commentCtrl: FormControl = new FormControl('');

  cancel() {
    this.dialogRef.close();
  }

  confrim() {
    this.dialogRef.close(this.commentCtrl.value);
  }
}
