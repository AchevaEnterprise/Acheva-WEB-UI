import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { LevelsEnum } from '../../../@core/models/school.model';
import { ToastService } from '../../../@core/utility/toast.service';
import { LecturersService } from '../../../@features/user-settings/service/lecturer.service';
import { ButtonComponent } from '../forms/button/button.component';
import { SvgComponent } from '../svg/svg.component';

@Component({
  selector: 'app-unassign-course-advisor',
  imports: [MatDialogModule, ButtonComponent, SvgComponent],
  templateUrl: './unassign-course-advisor.component.html',
  styleUrl: './unassign-course-advisor.component.scss',
})
export class UnassignCourseAdvisorComponent {
  private readonly lecturerService = inject(LecturersService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(
    MatDialogRef<UnassignCourseAdvisorComponent>
  );
  readonly data = inject<{
    lecturerId: string;
    assignedLevel: LevelsEnum;
    assignedLevelAdmissionYear: string;
  }>(MAT_DIALOG_DATA);

  cancel() {
    this.dialogRef.close();
  }

  unAssign() {
    const { lecturerId, assignedLevel, assignedLevelAdmissionYear } = this.data;
    this.lecturerService
      .assignOrUnassignCourseAdvisor(
        lecturerId,
        assignedLevel,
        assignedLevelAdmissionYear
      )
      .subscribe({
        next: (resp) => {
          if (!resp.status) {
            this.toast.showNotification(
              'error',
              'Error Unassigning Role',
              'Failed to unassign role from lecturer.'
            );
            return;
          }

          this.toast.showNotification(
            'success',
            'Role Unassigned',
            'The role has been successfully unassigned from the lecturer.'
          );
          this.dialogRef.close(resp);
        },
      });
  }
}
