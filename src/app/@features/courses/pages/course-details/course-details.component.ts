import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { finalize, Subscription } from 'rxjs';
import {
  IDepartment,
  IFaculty,
  ISchool,
  LevelsEnum,
  SemesterEnum,
} from '../../../../@core/models/school.model';
import { AppState } from '../../../../@core/store/app.state';
import {
  loadDepartments,
  loadFaculties,
  loadSchools,
} from '../../../../@core/store/school/school.action';
import {
  departmentsSelector,
  facultiesSelector,
  schoolsSelector,
} from '../../../../@core/store/school/school.selector';
import { NotificationService } from '../../../../@core/utility/notification.service';
import { UtilityService } from '../../../../@core/utility/utility.service';
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
export class CourseDetailsComponent implements OnInit, OnDestroy {
  // private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly courseService = inject(CoursesService);
  private readonly notificationService = inject(NotificationService);
  private readonly utilsService = inject(UtilityService);
  private readonly store = inject(Store<AppState>);

  // private readonly courseTemplateId =
  //   this.route.snapshot.paramMap.get('templateId');
  private readonly createNew = this.route.snapshot.queryParamMap.get('new');

  isLoading = signal<boolean>(false);
  sessionOptions = signal<string[]>(this.utilsService.generateSchoolSessions());
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
    faculty: new FormControl<IFaculty | null>(null, Validators.required),
    department: new FormControl<IDepartment | null>(null, Validators.required),
    level: new FormControl<string>('', Validators.required),
    courseLoad: new FormControl<number>(1, Validators.required),
  });

  private readonly sub: Subscription = new Subscription();

  ngOnInit(): void {
    if (this.createNew === 'true') this.enableDiabledFieldsOnCreate();
    this.getSchools();
  }

  enableDiabledFieldsOnCreate() {
    this.form.get('semester')?.enable();
    this.form.get('courseTitle')?.enable();
    this.form.get('courseCode')?.enable();
    this.form.get('courseCordinator')?.enable();
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
              // this.router.navigate(['/my-result/upload-result']);
            }
          },
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
