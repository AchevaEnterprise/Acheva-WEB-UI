import { Component, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { ToastService } from '../../../@core/utility/toast.service';
import { CoursesService } from '../../../@features/courses/services/courses.service';
import { AssignCourseCoordinatorComponent } from '../assign-course-coordinator/assign-course-coordinator.component';
import { ButtonComponent } from '../forms/button/button.component';
import { SvgComponent } from '../svg/svg.component';

@Component({
  selector: 'app-unassign-course-cordinator',
  imports: [MatDialogModule, ButtonComponent, SvgComponent],
  templateUrl: './unassign-course-cordinator.component.html',
  styleUrl: './unassign-course-cordinator.component.scss',
})
export class UnassignCourseCordinatorComponent {
  private readonly courseService = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(
    MatDialogRef<AssignCourseCoordinatorComponent>
  );
  readonly data = inject<{
    courseId: string;
    lecturerId: string;
  }>(MAT_DIALOG_DATA);

  loading = signal(false);

  cancel() {
    this.dialogRef.close();
  }

  unAssign() {
    this.loading.set(true);

    const lecturerId = this.data.lecturerId;
    const courseId = this.data.courseId;
    this.courseService
      .unassignCourseFromLecturer(courseId, lecturerId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          if (!res.status) {
            this.toast.showNotification(
              'error',
              'Error Assigning Course',
              'Failed to assign course to lecturer.'
            );
            return;
          }

          this.toast.showNotification(
            'success',
            'Role Unassigned',
            'The role has been successfully unassigned from the lecturer.'
          );
          this.dialogRef.close(res);
        },
      });
  }
}
