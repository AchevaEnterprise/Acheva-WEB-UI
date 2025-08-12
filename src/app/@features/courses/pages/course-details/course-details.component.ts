import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../@core/utility/notification.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { CoursePreviewComponent } from '../../components/course-preview/course-preview.component';
import { ICreateCourse } from '../../models/course.model';
import { CoursesService } from '../../services/courses.service';

@Component({
  selector: 'app-course-details',
  imports: [
    CoursePreviewComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    ButtonComponent,
  ],
  templateUrl: './course-details.component.html',
  styleUrl: './course-details.component.scss',
})
export class CourseDetailsComponent {
  // private readonly router = inject(Router);
  private readonly courseService = inject(CoursesService);
  private readonly notificationService = inject(NotificationService);
  // private readonly courseTemplateId =
  //   this.route.snapshot.paramMap.get('templateId');

  isLoading = signal<boolean>(false);

  form = new FormGroup({
    session: new FormControl<string>('', Validators.required),
    semester: new FormControl<string>(
      { value: '1st Semester', disabled: true },
      Validators.required
    ),
    courseTitle: new FormControl<string>(
      { value: 'Database Management System', disabled: true },
      Validators.required
    ),
    courseCode: new FormControl<string>(
      { value: 'CSC 541', disabled: true },
      Validators.required
    ),
    courseCordinator: new FormControl<string>(
      { value: 'Dr. Nnamdi Araka', disabled: true },
      Validators.required
    ),
    faculty: new FormControl<string>('', Validators.required),
    department: new FormControl<string>('', Validators.required),
    level: new FormControl<string>('', Validators.required),
    courseLoad: new FormControl<number>(1, Validators.required),
  });

  increaseCourseUnit() {
    let unit = this.form.get('courseLoad')?.value as number;
    if (unit === 7) return;

    unit++;
    this.form.get('courseLoad')?.setValue(unit);
  }

  decreaseCourseUnit() {
    let unit = this.form.get('courseLoad')?.value as number;
    if (unit === 1) return;

    unit--;
    this.form.get('courseLoad')?.setValue(unit);
  }

  submit() {
    this.isLoading.set(true);
    const {
      semester,
      courseTitle,
      courseCode,
      courseLoad,
      faculty,
      department,
      level,
    } = this.form.getRawValue();

    const payload: ICreateCourse = {
      semester: semester || '',
      courseTitle: courseTitle || '',
      courseCode: courseCode || '',
      courseLoad: courseLoad || 0,
      faculty: faculty || '',
      department: department || '',
      level: level || '',
    };

    this.courseService
      .createCourse(payload)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.notificationService.showNotification(
              'success',
              'Course Created',
              'Your course has been created successfully'
            );
            // this.router.navigate(['/my-result/upload-result']);
          }
        },
      });
  }
}
