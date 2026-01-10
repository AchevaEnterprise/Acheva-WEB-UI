import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { LevelsEnum } from '../../../@core/models/school.model';
import { ToastService } from '../../../@core/utility/toast.service';
import { UtilityService } from '../../../@core/utility/utility.service';
import { LecturersService } from '../../../@features/user-settings/service/lecturer.service';
import { ButtonComponent } from '../forms/button/button.component';
import { UnassignCourseAdvisorComponent } from '../unassign-course-advisor/unassign-course-advisor.component';

@Component({
  selector: 'app-assign-course-advisor',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    ButtonComponent,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './assign-course-advisor.component.html',
  styleUrl: './assign-course-advisor.component.scss',
})
export class AssignCourseAdvisorComponent {
  private readonly lecturerService = inject(LecturersService);
  private readonly utilsService = inject(UtilityService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(
    MatDialogRef<UnassignCourseAdvisorComponent>
  );
  readonly data = inject<{
    lecturer: string;
    lecturerId: string;
  }>(MAT_DIALOG_DATA);

  levelCtrl: FormControl = new FormControl('');
  admissionYearOptions = signal<string[]>(
    this.utilsService.generateAdmissionYear()
  );
  levelOptions = signal<{ label: string; value: string }[]>([
    { label: '100 Level', value: LevelsEnum.YEAR_ONE },
    { label: '200 Level', value: LevelsEnum.YEAR_TWO },
    { label: '300 Level', value: LevelsEnum.YEAR_THREE },
    { label: '400 Level', value: LevelsEnum.YEAR_FOUR },
    { label: '500 Level', value: LevelsEnum.YEAR_FIVE },
    { label: '600 Level', value: LevelsEnum.YEAR_SIX },
    { label: 'Unregistered', value: LevelsEnum.UNREGISTERED },
  ]);

  form = new FormGroup({
    level: new FormControl<LevelsEnum>(
      LevelsEnum.YEAR_ONE,
      Validators.required
    ),
    admissionYear: new FormControl('', Validators.required),
  });

  cancel() {
    this.dialogRef.close();
  }

  assign() {
    const lecturerId = this.data.lecturerId;
    const { level, admissionYear } = this.form.value;

    this.lecturerService
      .assignOrUnassignCourseAdvisor(lecturerId, level!, admissionYear!)
      .subscribe({
        next: (resp) => {
          if (!resp.status) {
            this.toast.showNotification(
              'error',
              'Error Assigning Role',
              'Failed to assign role to lecturer.'
            );
            return;
          }

          this.toast.showNotification(
            'success',
            'Role assigned',
            'The role has been successfully assigned to the lecturer.'
          );
          this.dialogRef.close(resp);
        },
      });
  }
}
