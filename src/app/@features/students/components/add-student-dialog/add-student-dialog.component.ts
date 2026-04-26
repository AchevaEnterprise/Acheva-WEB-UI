import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { ICreateStudent } from '../../models/student.model';
import { StudentService } from '../../services/student.service';

@Component({
  selector: 'app-add-student-dialog',
  imports: [
    ButtonComponent,
    MatDialogModule,
    ReactiveFormsModule,
    MatInputModule,
  ],
  templateUrl: './add-student-dialog.component.html',
  styleUrl: './add-student-dialog.component.scss',
})
export class AddStudentDialogComponent {
  private readonly studentService = inject(StudentService);
  private readonly dialogRef = inject(MatDialogRef<AddStudentDialogComponent>);
  private readonly toast = inject(ToastService);

  loading = signal(false);

  form = new FormGroup({
    fullName: new FormControl<string>('', [
      Validators.required,
      Validators.pattern(/[a-zA-Z-?]+\s[a-zA-Z-?]+$/),
    ]),
    registrationNumber: new FormControl<string>('', Validators.required),
  });

  cancel() {
    this.dialogRef.close();
  }

  confirm() {
    this.loading.set(true);
    this.studentService
      .createStudent(this.form.value as ICreateStudent)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          if (!res.status) {
            this.toast.showNotification(
              'error',
              'Student Not Added',
              res.message || 'Failed to add student'
            );
            return;
          }

          this.toast.showNotification(
            'success',
            'Student Added',
            'Student added successfully'
          );
          this.dialogRef.close(res);
        },
      });
  }
}
