import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription, finalize } from 'rxjs';
import {
  IDepartment,
  IFaculty,
  ISchool,
  LevelsEnum,
  SemesterEnum,
} from '../../../../../../@core/models/school.model';
import { AppState } from '../../../../../../@core/store/app.state';
import {
  loadDepartments,
  loadFaculties,
  loadSchools,
} from '../../../../../../@core/store/school/school.action';
import {
  departmentsSelector,
  facultiesSelector,
  schoolsSelector,
} from '../../../../../../@core/store/school/school.selector';
import { NotificationService } from '../../../../../../@core/utility/notification.service';
import { ButtonComponent } from '../../../../../../@shared/components/forms/button/button.component';
import { ICreateCourse } from '../../../../../courses/models/course.model';
import { CoursesService } from '../../../../../courses/services/courses.service';
import { CoursePreviewComponent } from '../../../../components/course-preview/course-preview.component';

@Component({
  selector: 'app-create-course',
  imports: [
    CoursePreviewComponent,
    ReactiveFormsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    ButtonComponent,
  ],
  templateUrl: './create-course.component.html',
  styleUrl: './create-course.component.scss',
})
export class CreateCourseComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly courseService = inject(CoursesService);
  private readonly notificationService = inject(NotificationService);
  private readonly store = inject(Store<AppState>);

  isLoading = signal<boolean>(false);
  levelOptions = signal<{ label: string; value: string }[]>([
    { label: '100 Level', value: LevelsEnum.YEAR_ONE },
    { label: '200 Level', value: LevelsEnum.YEAR_TWO },
    { label: '300 Level', value: LevelsEnum.YEAR_THREE },
    { label: '400 Level', value: LevelsEnum.YEAR_FOUR },
    { label: '500 Level', value: LevelsEnum.YEAR_FIVE },
    { label: '600 Level', value: LevelsEnum.YEAR_SIX },
  ]);
  semesterOptions = signal<{ label: string; value: string }[]>([
    { label: '1st Semester', value: SemesterEnum.FIRST },
    { label: '2nd Semester', value: SemesterEnum.SECOND },
    { label: '3rd Semester', value: SemesterEnum.THIRD },
  ]);
  schoolsOptions = signal<ISchool[]>([]);
  facultiesOptions = signal<IFaculty[]>([]);
  departmentsOptions = signal<IDepartment[]>([]);

  form = new FormGroup({
    semester: new FormControl<string>('', Validators.required),
    courseTitle: new FormControl<string>('', Validators.required),
    courseCode: new FormControl<string>('', Validators.required),
    school: new FormControl<ISchool | null>(null, Validators.required),
    faculty: new FormControl<IFaculty | null>(null, Validators.required),
    department: new FormControl<IDepartment | null>(null, Validators.required),
    level: new FormControl<string>('', Validators.required),
    courseLoad: new FormControl<number>(1, Validators.required),
  });

  private readonly sub: Subscription = new Subscription();

  ngOnInit(): void {
    this.getSchools();
  }

  getSchools() {
    this.store.dispatch(loadSchools());

    this.sub.add(
      this.store.select(schoolsSelector).subscribe({
        next: (schools) => {
          this.schoolsOptions.set(schools);
        },
      })
    );
  }

  getFaculties(event: MatSelectChange) {
    const { _id } = event.value as ISchool;
    this.store.dispatch(loadFaculties({ schoolId: _id }));

    this.sub.add(
      this.store.select(facultiesSelector).subscribe({
        next: (faculties) => {
          this.facultiesOptions.set(faculties);
        },
      })
    );
  }

  getDepartments(event: MatSelectChange) {
    const { _id } = event.value as IFaculty;
    this.store.dispatch(loadDepartments({ facultyId: _id }));

    this.sub.add(
      this.store.select(departmentsSelector).subscribe({
        next: (departments) => {
          this.departmentsOptions.set(departments);
        },
      })
    );
  }

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
      faculty: faculty!.name || '',
      department: department!.name || '',
      level: level || '',
    };

    this.sub.add(
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
              this.router.navigate(['../course-management'], {
                relativeTo: this.route,
              });
            }
          },
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
