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
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  Subject,
  Subscription,
  takeUntil,
} from 'rxjs';
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
import { ToastService } from '../../../../../../@core/utility/toast.service';
import { CardComponent } from '../../../../../../@shared/components/card/card.component';
import { AutocompleteInputComponent } from '../../../../../../@shared/components/forms/autocomplete-input/autocomplete-input.component';
import { ButtonComponent } from '../../../../../../@shared/components/forms/button/button.component';
import { AuthenticationService } from '../../../../../auth/service/auth.service';
import { CoursePreviewComponent } from '../../../../../courses/components/course-preview/course-preview.component';
import {
  ICourse,
  ICreateCourse,
} from '../../../../../courses/models/course.model';
import { CoursesService } from '../../../../../courses/services/courses.service';

@Component({
  selector: 'app-create-course',
  imports: [
    CoursePreviewComponent,
    ReactiveFormsModule,
    AutocompleteInputComponent,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    ButtonComponent,
    CardComponent,
  ],
  templateUrl: './create-course.component.html',
  styleUrl: './create-course.component.scss',
})
export class CreateCourseComponent implements OnInit, OnDestroy {
  // ========================================
  // DEPENDENCY INJECTION
  // ========================================
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthenticationService);
  private readonly courseService = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(Store<AppState>);

  // ========================================
  // DATA
  // ========================================
  private readonly userSchoolId =
    this.authService.activeAccount()?.school!._id || '';

  private readonly userFacultyId =
    this.authService.activeAccount()?.faculty!._id || '';

  private readonly userDepartmentId =
    this.authService.activeAccount()?.department!._id || '';

  courses = signal<ICourse[]>([]);
  invalidCourseCodeError: string | null = null;
  showCourseCodeError = true;
  private readonly courseCodeInput$ = new Subject<string>();

  // ========================================
  // COMPONENT STATE
  // ========================================
  isLoading = signal<boolean>(false);
  isloadingCourses = signal<boolean>(true);

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
    // { label: '3rd Semester', value: SemesterEnum.THIRD },
  ]);

  schoolsOptions = signal<ISchool[]>([]);
  facultiesOptions = signal<IFaculty[]>([]);
  departmentsOptions = signal<IDepartment[]>([]);
  private readonly destroy$ = new Subject<void>();

  // ========================================
  // SEPARATE COURSE CODE CONTROL
  // ========================================
  // courseCodeControl = new FormControl<string>('', Validators.required);

  // ========================================
  // FORM CONFIGURATION
  // ========================================
  form = new FormGroup({
    semester: new FormControl<string>(
      this.semesterOptions()[0].value,
      Validators.required
    ),
    courseCode: new FormControl<string>(
      { value: '', disabled: false },
      Validators.required
    ),
    courseTitle: new FormControl<string>('', Validators.required),
    school: new FormControl<ISchool | string>(
      { value: this.userSchoolId, disabled: true },
      Validators.required
    ),
    faculty: new FormControl<IFaculty | null>(null, Validators.required),
    department: new FormControl<IDepartment | null>(null, Validators.required),
    level: new FormControl<string>(
      this.levelOptions()[0].value,
      Validators.required
    ),
    courseLoad: new FormControl<number>(1, Validators.required),
  });

  private readonly sub: Subscription = new Subscription();

  // ========================================
  // LIFECYCLE HOOKS
  // ========================================
  ngOnInit(): void {
    this.initializeComponent();
    this.setupCourseCodeListener();
    this.updateFaultyAndDepartment();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateFaultyAndDepartment() {
    const { faculty, department } = this.authService.activeAccount()!;
    this.form.patchValue({
      faculty: faculty,
      department: department,
    });

    this.form.controls['faculty'].disable();
    this.form.controls['department'].disable();
  }

  private setupCourseCodeListener(): void {
    this.courseCodeInput$
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((code) => {
        this.lookupCourseTitle(code);
      });
  }

  // ========================================
  // INITIALIZATION METHODS
  // ========================================
  private initializeComponent(): void {
    this.handleRouteParams();
    this.getSchools();
    this.loadCourses();
  }

  private handleRouteParams(): void {
    this.route.queryParams.subscribe((params) => {
      const selectedLevel = params['level'] as string | undefined;

      if (selectedLevel) {
        this.form.get('level')?.setValue(selectedLevel);
      } else {
        this.form.get('level')?.setValue(this.levelOptions()[0].value);
      }
    });
  }

  get courseCodeControl(): FormControl<string> {
    return this.form.get('courseCode') as FormControl<string>;
  }

  /**
   * Shape the form value for the shared `CoursePreviewComponent`.
   * The preview component reads `school/faculty/department` as objects, so
   * we surface the current user's school from the active account to avoid
   * showing a blank row during course creation.
   */
  get previewTemplate() {
    return {
      ...this.form.getRawValue(),
      school: this.authService.activeAccount()?.school,
    };
  }

  // ========================================
  // DATA FETCHING METHODS
  // ========================================
  loadCourses(): void {
    this.sub.add(
      this.courseService
        .getCourses()
        .pipe(
          map((resp) => resp.data['courses']),
          finalize(() => this.isloadingCourses.set(false))
        )
        .subscribe({
          next: (courses) => this.courses.set(courses),
          error: (error) => {
            this.isloadingCourses.set(false);
          },
        })
    );
  }

  getSchools() {
    this.store.dispatch(loadSchools());

    this.sub.add(
      this.store.select(schoolsSelector).subscribe({
        next: (schools) => {
          this.schoolsOptions.set(schools);

          const schoolId = this.form.get('school')?.value as string;
          if (schoolId) this.getFaculties(schoolId);
        },
      })
    );
  }

  getFaculties(event: MatSelectChange | string) {
    let schoolId: string = '';

    if (typeof event === 'string') schoolId = event;
    else schoolId = (event.value as ISchool)._id;

    this.store.dispatch(loadFaculties({ schoolId }));

    this.sub.add(
      this.store.select(facultiesSelector).subscribe({
        next: (faculties) => {
          this.facultiesOptions.set(faculties);

          // Auto-select user's faculty if available
          this.autoSelectUserFaculty(faculties);

          this.getDepartments(this.userFacultyId);
        },
      })
    );
  }

  getDepartments(event: MatSelectChange | string) {
    let facultyId: string = '';

    if (typeof event === 'string') {
      facultyId = event;
    } else {
      facultyId = (event.value as IFaculty)._id;
    }

    this.store.dispatch(loadDepartments({ facultyId }));

    this.sub.add(
      this.store.select(departmentsSelector).subscribe({
        next: (departments) => {
          this.departmentsOptions.set(departments);

          // Auto-select user's department if available
          this.autoSelectUserDepartment(departments);
        },
      })
    );
  }

  // ========================================
  // COURSE CODE HANDLING
  // ========================================
  onCodeSelected(courseCode: string): void {
    this.courseCodeControl.setValue(courseCode);
    this.lookupCourseTitle(courseCode);
  }

  onCourseCodeChanged(code: string): void {
    this.courseCodeInput$.next(code);
    this.form.get('courseCode')?.setValue(code);
  }

  private lookupCourseTitle(courseCode: string): void {
    // Wait for courses to load
    if (this.isloadingCourses() || this.courses().length === 0) {
      return;
    }

    const matched = this.courses().find(
      (course) =>
        course.courseCode.trim().toLowerCase() ===
        courseCode.trim().toLowerCase()
    );

    if (matched) {
      this.updateFormWithMatchedCourse(matched);
      this.invalidCourseCodeError = null;
      this.showCourseCodeError = false;
    } else {
      this.clearAutoFillFields();
      this.invalidCourseCodeError = 'The entered course code is not valid.';
      this.showCourseCodeError = true;
    }
  }

  private updateFormWithMatchedCourse(course: ICourse): void {
    // Autofill course title and load
    this.form.patchValue({
      courseTitle: course.courseTitle,
      courseLoad: course.courseLoad,
    });

    // Autofill additional fields if available
    if (course.level) {
      this.form.get('level')?.setValue(course.level);
    }
    if (course.semester) {
      this.form.get('semester')?.setValue(course.semester);
    }

    // Clear errors
    this.invalidCourseCodeError = null;
    this.showCourseCodeError = false;
  }

  private clearAutoFillFields(): void {
    this.form.patchValue({
      courseTitle: '',
      courseLoad: 1,
    });
  }

  get courseCodes(): string[] {
    return this.courses().map((course) => course.courseCode);
  }

  // ========================================
  // AUTO-SELECTION METHODS
  // ========================================
  private autoSelectUserFaculty(faculties: IFaculty[]): void {
    if (!this.userFacultyId || faculties.length === 0) return;

    const userFaculty = faculties.find(
      (faculty) => faculty._id === this.userFacultyId
    );

    if (userFaculty) {
      this.form.get('faculty')?.setValue(userFaculty);
    }
  }

  private autoSelectUserDepartment(departments: IDepartment[]): void {
    if (!this.userDepartmentId || departments.length === 0) return;

    const userDepartment = departments.find(
      (dept) => dept._id === this.userDepartmentId
    );

    if (userDepartment) {
      this.form.get('department')?.setValue(userDepartment);
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================
  compareSchoolFn(o1: any, o2: any) {
    return o1 && o2 ? o1._id === o2 : o1 === o2;
  }

  compareFacultyFn(o1: IFaculty, o2: IFaculty): boolean {
    return o1 && o2 ? o1._id === o2._id : o1 === o2;
  }

  compareDepartmentFn(o1: IDepartment, o2: IDepartment): boolean {
    return o1 && o2 ? o1._id === o2._id : o1 === o2;
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

  // ========================================
  // ACTION METHODS
  // ========================================
  submit() {
    this.isLoading.set(true);

    // Get course code from separate control
    const courseCode = this.courseCodeControl.value || '';

    const { semester, courseTitle, courseLoad, faculty, department, level } =
      this.form.getRawValue();

    const payload: ICreateCourse = {
      semester: semester || '',
      courseTitle: courseTitle || '',
      courseCode: courseCode,
      courseLoad: courseLoad || 0,
      faculty: (faculty as IFaculty)._id || '',
      department: (department as IDepartment)._id || '',
      level: level || '',
    };

    this.sub.add(
      this.courseService
        .createCourse(payload)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (resp) => {
            if (resp.status) {
              this.toast.showNotification(
                'success',
                'Course Created',
                'Your course has been created successfully'
              );
              this.router.navigate(['../course-management'], {
                relativeTo: this.route,
                queryParams: { level },
              });
            }
          },
          error: (error) => {
            this.toast.showNotification(
              'error',
              'Course Creation Failed',
              error.error.message ||
                'An error occurred while creating the course'
            );
          },
        })
    );
  }

  cancel() {
    this.router.navigate(['../course-management/'], { relativeTo: this.route });
  }
}
