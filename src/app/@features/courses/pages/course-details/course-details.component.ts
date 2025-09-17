import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  filter,
  finalize,
  Subscription,
  take,
  map,
  Subject,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
} from 'rxjs';
import { CommonModule, Location } from '@angular/common';

import {
  IDepartment,
  IFaculty,
  ISchool,
  LevelsEnum,
  SemesterEnum,
} from '../../../../@core/models/school.model';
import { ICourse } from '../../models/course.model';
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
import { ToastService } from '../../../../@core/utility/toast.service';
import { UtilityService } from '../../../../@core/utility/utility.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import {
  ICreateResult,
  ResultStatusEnum,
} from '../../../result-management/models/results.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { CoursePreviewComponent } from '../../components/course-preview/course-preview.component';
import { CoursesService } from '../../services/courses.service';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { profileSelector } from '../../../../@core/store/profile/profile.selector';
import { AutocompleteInputComponent } from '../../../../@shared/components/forms/autocomplete-input/autocomplete-input.component';

@Component({
  selector: 'app-course-details',
  imports: [
    CommonModule,
    MatAutocompleteModule,
    AutocompleteInputComponent,
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
  // Dependency injection
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly courseService = inject(CoursesService);
  private readonly resultService = inject(ResultsService);
  private readonly toast = inject(ToastService);
  private readonly utilsService = inject(UtilityService);
  private readonly store = inject(Store<AppState>);
  private readonly location = inject(Location);
  private readonly authService = inject(AuthenticationService);

  // Public properties
  activeAccount = this.authService.activeAccount;

  // Private properties
  private readonly courseId = this.route.snapshot.queryParamMap.get('courseId');
  private readonly courseCodeInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private readonly sub = new Subscription();

  // Signals for reactive state
  isLoading = signal<boolean>(false);
  isloadingCourses = signal<boolean>(true);
  filteredCourses = signal<ICourse[]>([]);
  courses = signal<ICourse[]>([]);
  selectedCourseId = signal<string>('');

  // Options for dropdowns
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

  // Form configuration
  form = new FormGroup({
    session: new FormControl<string>('', Validators.required),
    semester: new FormControl<string>(
      { value: '', disabled: false },
      Validators.required
    ),
    courseTitle: new FormControl<string>(
      { value: '', disabled: true },
      Validators.required
    ),
    courseCode: new FormControl<string>(
      { value: '', disabled: false },
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
      { value: '', disabled: false },
      Validators.required
    ),
    courseLoad: new FormControl<number>(1, Validators.required),
  });

  ngOnInit(): void {
    this.initializeComponent();
    this.setupCourseCodeListener();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Getters for template
  get courseCodes(): string[] {
    return this.courses().map((course) => course.courseCode);
  }

  // Initialization methods
  private initializeComponent(): void {
    if (this.courseId) {
      this.getCourse();
    }
    this.loadCourses();
    this.loadUserSchool();
    this.getSchools();
  }

  private setupCourseCodeListener(): void {
    this.courseCodeInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((code) => {
        this.lookupCourseTitleAndCordinator(code);
      });
  }

  // Course loading methods
  loadCourses(): void {
    this.sub.add(
      this.courseService
        .getCourses()
        .pipe(
          map((resp) => resp.data.courses),
          finalize(() => this.isloadingCourses.set(false))
        )
        .subscribe({
          next: (courses) => this.courses.set(courses),
          error: (error) => {
            console.error('Error loading courses:', error);
            this.isloadingCourses.set(false);
          },
        })
    );
  }

  getCourse(): void {
    this.courseService.getCourse(this.courseId!).subscribe({
      next: (res) => {
        if (res.status) {
          this.populateFormFromCourseData(res.data);
        }
      },
    });
  }

  private populateFormFromCourseData(courseData: any): void {
    const {
      courseTitle,
      courseCode,
      courseLoad,
      assignedTo,
      school,
      faculty,
      department,
      level,
      semester,
    } = courseData;

    const courseCordinator = assignedTo
      ? `${assignedTo?.firstname} ${assignedTo?.lastname}`
      : 'Not Assigned';

    this.form.patchValue({
      courseTitle,
      courseCode,
      courseCordinator,
      level,
      courseLoad,
      semester,
      school: school as unknown as ISchool,
      faculty: faculty as unknown as IFaculty,
      department: department as unknown as IDepartment,
    });

    // Disable fields that shouldn't be edited
    this.disableFieldsAfterCourseLoad(level, semester, courseCode);
  }

  private disableFieldsAfterCourseLoad(
    level: string,
    semester: string,
    courseCode: string
  ): void {
    if (level) this.form.get('level')?.disable();
    if (semester) this.form.get('semester')?.disable();
    if (courseCode) this.form.get('courseCode')?.disable();
  }

  // School hierarchy methods
  getSchools(): void {
    this.store.dispatch(loadSchools());
    this.sub.add(
      this.store.select(schoolsSelector).subscribe({
        next: (schools) => {
          this.schoolsOptions.set(schools);
          const school = this.form.get('school')?.value as ISchool;
          if (school) this.getFaculties(school._id);
        },
      })
    );
  }

  loadUserSchool(): void {
    this.sub.add(
      this.store
        .select(profileSelector)
        .pipe(
          filter((profile) => !!profile?.schoolInfo),
          take(1)
        )
        .subscribe((profile) => {
          const school = profile!.schoolInfo!;
          this.form.patchValue({ school });
          this.getFaculties(school._id);
        })
    );
  }

  getFaculties(event: MatSelectChange | string): void {
    const schoolId =
      typeof event === 'string' ? event : (event.value as ISchool)._id;

    this.store.dispatch(loadFaculties({ schoolId }));
    this.sub.add(
      this.store.select(facultiesSelector).subscribe({
        next: (faculties) => {
          this.facultiesOptions.set(faculties);
          if (typeof event === 'string') {
            const faculty = this.form.get('faculty')?.value as IFaculty;
            if (faculty) this.getDepartments(faculty._id);
          }
        },
      })
    );
  }

  getDepartments(event: MatSelectChange | string): void {
    const facultyId =
      typeof event === 'string' ? event : (event.value as IFaculty)._id;

    this.store.dispatch(loadDepartments({ facultyId }));
    this.sub.add(
      this.store.select(departmentsSelector).subscribe({
        next: (departments) => this.departmentsOptions.set(departments),
      })
    );
  }

  // Course selection and autocomplete methods
  onCourseCodeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const inputValue = target.value;

    const selectedCourse = this.findCourseByInput(inputValue);

    if (selectedCourse) {
      this.autofillCourseData(selectedCourse);
    } else {
      this.clearCourseData();
    }
  }

  private findCourseByInput(inputValue: string): ICourse | undefined {
    return this.courses().find(
      (course) =>
        course.courseCode === inputValue ||
        `${course.courseCode} - ${course.courseTitle}` === inputValue
    );
  }

  onCodeSelected(courseCode: string): void {
    this.form.get('courseCode')?.setValue(courseCode);
    this.lookupCourseTitleAndCordinator(courseCode);
  }

  onCourseCodeChanged(code: string): void {
    this.courseCodeInput$.next(code);
  }

  private lookupCourseTitleAndCordinator(courseCode: string): void {
    const matched = this.courses().find(
      (course) =>
        course.courseCode.trim().toLowerCase() ===
        courseCode.trim().toLowerCase()
    );

    if (matched) {
      this.updateFormWithMatchedCourse(matched);
    } else {
      this.clearAutoFillFields();
    }
  }

  private updateFormWithMatchedCourse(course: ICourse): void {
    const coordinator = course.assignedTo
      ? `${course.assignedTo.firstname} ${course.assignedTo.lastname}`
      : 'N/A';

    this.form.patchValue({
      courseTitle: course.courseTitle,
      courseCordinator: coordinator,
      courseLoad: course.courseLoad,
    });
  }

  private clearAutoFillFields(): void {
    this.form.patchValue({
      courseTitle: '',
      courseCordinator: 'N/A',
      courseLoad: 1,
    });
  }

  private autofillCourseData(course: ICourse): void {
    const courseCordinator = course.assignedTo
      ? `${course.assignedTo.firstname} ${course.assignedTo.lastname}`
      : 'Not Assigned';

    this.form.patchValue({
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      courseCordinator: courseCordinator,
      level: course.level,
      semester: course.semester,
      school: course.school as unknown as ISchool,
      faculty: course.faculty as unknown as IFaculty,
      department: course.department as unknown as IDepartment,
    });

    // Disable fields after auto-fill
    this.form.get('level')?.disable();
    this.form.get('semester')?.disable();
  }

  private clearCourseData(): void {
    this.selectedCourseId.set('');
    this.form.patchValue({
      courseTitle: '',
      courseCordinator: '',
    });

    // Re-enable fields
    this.form.get('level')?.enable();
    this.form.get('semester')?.enable();
  }

  // Course unit management
  increaseCourseUnit(): void {
    const currentUnit = this.form.get('courseLoad')?.value as number;
    if (currentUnit < 7) {
      this.form.get('courseLoad')?.setValue(currentUnit + 1);
    }
  }

  decreaseCourseUnit(): void {
    const currentUnit = this.form.get('courseLoad')?.value as number;
    if (currentUnit > 1) {
      this.form.get('courseLoad')?.setValue(currentUnit - 1);
    }
  }

  // Form submission and navigation
  submit(): void {
    this.isLoading.set(true);
    const { session, semester, school, department, level } =
      this.form.getRawValue();
    const courseIdToUse = this.selectedCourseId() || this.courseId!;

    const payload: ICreateResult = {
      course: courseIdToUse,
      session: session || '',
      level: level || '',
      semester: semester || '',
      school: (school as ISchool)._id,
      department: (department as IDepartment)._id,
      status: ResultStatusEnum.PENDING,
    };

    this.sub.add(
      this.resultService
        .createResult(payload)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (resp) => {
            if (resp.status) {
              this.toast.showNotification(
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

  cancel(): void {
    this.location.back();
  }

  // Comparison functions for mat-select
  compareSchoolFn = (o1: any, o2: any) =>
    o1 && o2 ? o1._id === o2._id : o1 === o2;
  compareFacultyFn = (o1: any, o2: any) =>
    o1 && o2 ? o1._id === o2._id : o1 === o2;
  compareDepartmentFn = (o1: any, o2: any) =>
    o1 && o2 ? o1._id === o2._id : o1 === o2;

  // Legacy method for autocomplete display
  displayFn(course: ICourse): string {
    return course ? `${course.courseCode} - ${course.courseTitle}` : '';
  }
}
