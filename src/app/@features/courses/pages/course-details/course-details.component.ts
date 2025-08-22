import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, finalize, Subscription } from 'rxjs';
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
import { SearchSelectComponent } from '../../../../@shared/components/forms/search-select/search-select.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import {
  ICreateResult,
  ResultStatusEnum,
} from '../../../result-management/models/results.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { CoursePreviewComponent } from '../../components/course-preview/course-preview.component';
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
    MatProgressSpinnerModule,
    SearchSelectComponent,
  ],
  templateUrl: './course-details.component.html',
  styleUrl: './course-details.component.scss',
})
export class CourseDetailsComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly courseService = inject(CoursesService);
  private readonly authService = inject(AuthenticationService);
  private readonly resultService = inject(ResultsService);
  private readonly notificationService = inject(NotificationService);
  private readonly utilsService = inject(UtilityService);
  private readonly store = inject(Store<AppState>);

  private readonly courseId = this.route.snapshot.queryParamMap.get('courseId');
  readonly createNew = this.route.snapshot.queryParamMap.get('new');

  private readonly school = this.authService.activeAccount()?.school || '';

  isLoadingFaculties = signal<boolean>(false);
  isLoadingDepartments = signal<boolean>(false);

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
      { value: '', disabled: true },
      Validators.required
    ),
    courseTitle: new FormControl<string>(
      { value: '', disabled: true },
      Validators.required
    ),
    courseCode: new FormControl<string>(
      { value: '', disabled: true },
      Validators.required
    ),
    courseCordinator: new FormControl<string>(
      { value: '', disabled: true },
      Validators.required
    ),
    school: new FormControl<ISchool | null>(
      { value: null, disabled: true },
      Validators.required
    ),
    faculty: new FormControl<IFaculty | null>(null, Validators.required),
    department: new FormControl<IDepartment | null>(null, Validators.required),
    level: new FormControl<string>(
      { value: '', disabled: true },
      Validators.required
    ),
    courseLoad: new FormControl<number>(1, Validators.required),
  });

  selectedSchool = signal<string>('');
  selectedFaculty = signal<string>('');
  selectedDepartment = signal<string>('');

  private readonly sub: Subscription = new Subscription();

  ngOnInit(): void {
    if (this.createNew === 'true') {
      this.selectedSchool.set(this.school);
      this.getSchools();
      this.enableDiabledFieldsOnCreate();
    } else this.getCourse();
  }

  enableDiabledFieldsOnCreate() {
    this.form.get('semester')?.enable();
    this.form.get('level')?.enable();
    this.form.get('courseTitle')?.enable();
    this.form.get('courseCode')?.enable();
    this.form.get('courseCordinator')?.enable();
  }

  compareSchoolFn(o1: any, o2: any) {
    return o1 && o2 ? o1._id === o2._id : o1 === o2;
  }

  compareFacultyFn(o1: any, o2: any) {
    return o1 && o2 ? o1._id === o2._id : o1 === o2;
  }

  compareDepartmentFn(o1: any, o2: any) {
    return o1 && o2 ? o1._id === o2._id : o1 === o2;
  }

  getCourse() {
    this.courseService.getCourse(this.courseId!).subscribe({
      next: (res) => {
        if (res.status) {
          const {
            courseTitle,
            courseCode,
            courseCordinator,
            school,
            faculty,
            department,
            level,
            semester,
          } = res.data;

          this.form.patchValue({
            courseTitle,
            courseCode,
            courseCordinator,
            level,
            semester,
          });

          this.selectedSchool.set(school);
          this.selectedFaculty.set(faculty);
          this.selectedDepartment.set(department);
          this.getSchools();
        }
      },
    });
  }

  getSchools() {
    this.store.dispatch(loadSchools());

    this.sub.add(
      this.store.select(schoolsSelector).subscribe({
        next: (schools) => {
          this.schoolsOptions.set(schools);

          this.schoolsOptions()?.forEach((school) => {
            if (school.name === this.selectedSchool()) {
              this.form.get('school')?.setValue(school);
            }
          });

          const school = this.form.get('school')?.value as ISchool;
          if (school) this.getFaculties(school._id);
        },
      })
    );
  }

  getFaculties(event: MatSelectChange | string) {
    this.isLoadingFaculties.set(true);
    let schoolId: string = '';

    if (typeof event === 'string') schoolId = event;
    else schoolId = (event.value as ISchool)._id;

    this.store.dispatch(loadFaculties({ schoolId }));

    this.sub.add(
      this.store
        .select(facultiesSelector)
        .pipe(
          filter(
            (faculties) => Array.isArray(faculties) && faculties.length > 0
          )
        )
        .subscribe({
          next: (faculties) => {
            this.isLoadingFaculties.set(false);
            this.facultiesOptions.set(faculties);

            if (typeof event === 'string') {
              this.facultiesOptions()?.forEach((facility) => {
                if (facility.name === this.selectedFaculty()) {
                  this.form.get('faculty')?.setValue(facility);
                }
              });

              const facility = this.form.get('faculty')?.value as IFaculty;
              if (facility) this.getDepartments(facility._id);
            }
          },
        })
    );
  }

  getDepartments(event: MatSelectChange | string) {
    this.isLoadingDepartments.set(true);
    let facultyId: string = '';

    if (typeof event === 'string') facultyId = event;
    else facultyId = (event.value as IFaculty)._id;

    this.store.dispatch(loadDepartments({ facultyId }));

    this.sub.add(
      this.store
        .select(departmentsSelector)
        .pipe(
          filter(
            (departments) =>
              Array.isArray(departments) && departments.length > 0
          )
        )
        .subscribe({
          next: (departments) => {
            this.isLoadingDepartments.set(false);
            this.departmentsOptions.set(departments);

            if (typeof event === 'string') {
              this.departmentsOptions()?.forEach((department) => {
                if (department.name === this.selectedDepartment()) {
                  this.form.get('department')?.setValue(department);
                }
              });
            }
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
    const { session, semester, school, department, level } =
      this.form.getRawValue();

    const payload: ICreateResult = {
      course: this.courseId!,
      session: session || '',
      level: level || '',
      semester: semester || '',
      school: (school as ISchool).name,
      department: (department as IDepartment).name,
      status: ResultStatusEnum.PENDING,
    };

    this.sub.add(
      this.resultService
        .createResult(payload)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (resp) => {
            if (resp.status) {
              this.notificationService.showNotification(
                'success',
                'Result Created',
                'Your result has been created successfully'
              );
              this.router.navigate(['/my-result/upload-result'], {
                queryParams: { resultId: resp.data._id as string },
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
