import { CommonModule, Location } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { finalize, map } from 'rxjs';

import { MatDivider } from '@angular/material/divider';
import {
  IDepartment,
  IFaculty,
  ISchool,
  LevelsEnum,
  SemesterEnum,
} from '../../../../@core/models/school.model';
import { SchoolsService } from '../../../../@core/services/schools.service';
import { AppState } from '../../../../@core/store/app.state';
import {
  loadDepartments,
  loadFaculties,
} from '../../../../@core/store/school/school.action';
import {
  departmentsSelector,
  facultiesSelector,
} from '../../../../@core/store/school/school.selector';
import { ToastService } from '../../../../@core/utility/toast.service';
import { UtilityService } from '../../../../@core/utility/utility.service';
import { BackButtonComponent } from '../../../../@shared/components/back-button/back-button.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchSelectComponent } from '../../../../@shared/components/forms/search-select/search-select.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import {
  ICreateResult,
  ResultStatusEnum,
} from '../../../result-management/models/results.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { CoursePreviewComponent } from '../../components/course-preview/course-preview.component';
import { ICourse, ICourseQuery } from '../../models/course.model';
import { CoursesService } from '../../services/courses.service';

@Component({
  selector: 'app-course-details',
  imports: [
    CommonModule,
    MatAutocompleteModule,
    CoursePreviewComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    ButtonComponent,
    MatDivider,
    SearchSelectComponent,
    BackButtonComponent,
  ],
  templateUrl: './course-details.component.html',
  styleUrl: './course-details.component.scss',
})
export class CourseDetailsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly courseService = inject(CoursesService);
  private readonly resultService = inject(ResultsService);
  private readonly toast = inject(ToastService);
  private readonly utilsService = inject(UtilityService);
  private readonly authService = inject(AuthenticationService);
  private readonly store = inject(Store<AppState>);
  private readonly schoolService = inject(SchoolsService);
  private readonly location = inject(Location);

  private readonly courseId: string =
    this.route.snapshot.queryParamMap.get('courseId')!;
  readonly isNew = this.route.snapshot.queryParamMap.get('new');
  readonly destroyRef = inject(DestroyRef);

  isLoading = signal<boolean>(false);
  searchingCourseCodes = signal<boolean>(false);

  school = signal<ISchool | null>(null);
  courses = signal<{ label: string; value: ICourse }[]>([]);

  sessionOptions = signal<string[]>(this.utilsService.generateSchoolSessions());
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
    { label: 'Reference', value: LevelsEnum.REFERENCE },
    { label: 'Unregistered', value: LevelsEnum.UNREGISTERED },
  ]);
  semesterOptions = signal<{ label: string; value: string }[]>([
    { label: '1st Semester', value: SemesterEnum.FIRST },
    { label: '2nd Semester', value: SemesterEnum.SECOND },
    { label: '3rd Semester', value: SemesterEnum.THIRD },
  ]);
  facultiesOptions = signal<IFaculty[]>([]);
  departmentsOptions = signal<IDepartment[]>([]);

  form = new FormGroup({
    session: new FormControl<string>('', Validators.required),
    semester: new FormControl<string>('', Validators.required),
    admissionYear: new FormControl<string>('', Validators.required),
    courseTitle: new FormControl<string>('', Validators.required),
    courseCode: new FormControl<ICourse | string>('', Validators.required),
    courseCordinator: new FormControl<string>('', Validators.required),
    faculty: new FormControl<IFaculty | null>(null, Validators.required),
    department: new FormControl<IDepartment | null>(null, Validators.required),
    level: new FormControl<string>('', Validators.required),
    courseLoad: new FormControl<number>(1, Validators.required),
  });

  ngOnInit(): void {
    if (this.courseId) this.getCourse();
    else this.loadUserSchool();

    this.configureFormPropertiesToDisableOrEnable();
    if (this.isNew) this.updateFaultyAndDepartment();
  }

  get getCourseTemplate() {
    return { ...this.form.getRawValue(), school: this.school() };
  }

  loadUserSchool() {
    const { school } = this.authService.activeAccount()!;

    this.schoolService.getSchoolById(school!._id).subscribe({
      next: (resp) => {
        const { _id } = resp.data;
        this.school.set(resp.data);
        if (resp.status) this.getFaculties(_id);
      },
    });
  }

  configureFormPropertiesToDisableOrEnable() {
    if (this.isNew && !this.courseId) {
      this.form.enable();
      this.form.get('school')?.disable();
      this.form.get('courseTitle')?.disable();
      this.form.get('courseCordinator')?.disable();
      this.form.get('courseLoad')?.disable();

      // Fetch course codes if its a new result you are creating
      this.getCourseCodes();
    } else {
      this.form.get('school')?.disable();
      this.form.get('level')?.disable();
      this.form.get('semester')?.disable();
      this.form.get('courseCode')?.disable();
      this.form.get('courseTitle')?.disable();
      this.form.get('courseCordinator')?.disable();
      this.form.get('courseLoad')?.disable();
    }
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

  getCourseCodes(params?: Partial<ICourseQuery>) {
    this.searchingCourseCodes.set(true);
    this.courseService
      .getCourses(params)
      .pipe(
        map((res) => {
          const courses = res.data['courses'];
          return courses;
        }),
        finalize(() => this.searchingCourseCodes.set(false))
      )
      .subscribe({
        next: (courses: ICourse[]) => {
          const mappedCourses = courses.map((course) => ({
            label: course.courseCode,
            value: course,
          }));
          this.courses.set(mappedCourses);
          this.courseCodeListener();
        },
      });
  }

  findCourseByCourseCode(searchTerm: string) {
    this.getCourseCodes({ courseCode: searchTerm });
  }

  courseCodeListener() {
    this.form
      .get('courseCode')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (selectedCourse: ICourse | string | null) => {
          const { courseTitle, courseLoad, assignedTo, _id } =
            selectedCourse! as ICourse;

          const courseCordinator = assignedTo
            ? `${assignedTo?.firstname} ${assignedTo?.lastname}`
            : '';

          this.form.patchValue({
            courseTitle,
            courseLoad,
            courseCordinator,
          });

          this.router.navigate([], {
            queryParams: { courseId: _id },
            queryParamsHandling: 'merge',
          });
        },
      });
  }

  getCourse(): void {
    this.courseService.getCourse(this.courseId).subscribe({
      next: (res) => {
        if (res.status) {
          const {
            courseTitle,
            courseCode,
            courseLoad,
            assignedTo,
            faculty,
            department,
            level,
            semester,
          } = res.data;

          const courseCordinator = assignedTo
            ? `${assignedTo?.firstname} ${assignedTo?.lastname}`
            : '';

          this.form.patchValue({
            courseTitle,
            courseCode,
            courseCordinator,
            level,
            semester,
            courseLoad,
            faculty: faculty,
            department: department,
          });

          this.loadUserSchool();
        }
      },
    });
  }

  getFaculties(event: MatSelectChange | string): void {
    const schoolId =
      typeof event === 'string' ? event : (event.value as ISchool)._id;

    this.store.dispatch(loadFaculties({ schoolId }));
    this.store
      .select(facultiesSelector)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (faculties) => {
          this.facultiesOptions.set(faculties);
          if (typeof event === 'string') {
            const faculty = this.form.get('faculty')?.value as IFaculty;
            if (faculty) this.getDepartments(faculty._id);
          }
        },
      });
  }

  getDepartments(event: MatSelectChange | string): void {
    const facultyId =
      typeof event === 'string' ? event : (event.value as IFaculty)._id;

    this.store.dispatch(loadDepartments({ facultyId }));
    this.store
      .select(departmentsSelector)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (departments) => this.departmentsOptions.set(departments),
      });
  }

  cancel(): void {
    this.location.back();
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

  compareFacultyFn(faculty1: IFaculty, faculty2: IFaculty) {
    return faculty1 && faculty2
      ? faculty1._id === faculty2._id
      : faculty1 === faculty2;
  }

  compareDepartmentFn(department1: IDepartment, department2: IDepartment) {
    return department1 && department2
      ? department1._id === department2._id
      : department1 === department2;
  }

  submit(): void {
    const {
      session,
      admissionYear,
      semester,
      department,
      level,
      faculty,
      courseCordinator,
      courseCode,
    } = this.form.getRawValue();

    if (!courseCordinator || !faculty || !department) {
      this.toast.showNotification(
        'error',
        'Invalid Result Details',
        'Ensure all fields are filled'
      );
      return;
    }

    this.isLoading.set(true);
    const payload: ICreateResult = {
      course: this.courseId || (courseCode as ICourse)?._id!,
      session: session || '',
      admissionYear: admissionYear || '',
      level: level || '',
      semester: semester || '',
      school: this.school()?._id!,
      department: department?._id,
      faculty: faculty?._id,
      status: ResultStatusEnum.PENDING,
    };

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
              queryParams: { resultId: resp.data._id },
            });
          }
        },
      });
  }
}
