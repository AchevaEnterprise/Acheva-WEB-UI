import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  LevelsEnum,
  SemesterEnum,
} from '../../../../../@core/models/school.model';
import { AssignCourseCoordinatorComponent } from '../../../../../@shared/components/assign-course-coordinator/assign-course-coordinator.component';
import { BackButtonComponent } from '../../../../../@shared/components/back-button/back-button.component';
import { EmptyStateComponent } from '../../../../../@shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../../@shared/components/forms/button/button.component';
import { SkeletonTableComponent } from '../../../../../@shared/components/skeleton/skeleton-table.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../../@shared/components/segment-switcher/segment-switcher.component';
import { SvgComponent } from '../../../../../@shared/components/svg/svg.component';
import { UnassignCourseCordinatorComponent } from '../../../../../@shared/components/unassign-course-cordinator/unassign-course-cordinator.component';
import { ICourse, ICourseQuery } from '../../../../courses/models/course.model';
import { CoursesService } from '../../../../courses/services/courses.service';

@Component({
  selector: 'app-course-management',
  imports: [
    FormsModule,
    SvgComponent,
    SegmentSwitcherComponent,
    MatTableModule,
    DatePipe,
    ButtonComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    EmptyStateComponent,
    SkeletonTableComponent,
    BackButtonComponent,
  ],
  templateUrl: './course-management.component.html',
  styleUrl: './course-management.component.scss',
})
export class CourseManagementComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly courseService = inject(CoursesService);

  segments = signal<ISegmentSwitcher[]>([
    { label: '100L', value: LevelsEnum.YEAR_ONE },
    { label: '200L', value: LevelsEnum.YEAR_TWO },
    { label: '300L', value: LevelsEnum.YEAR_THREE },
    { label: '400L', value: LevelsEnum.YEAR_FOUR },
    { label: '500L', value: LevelsEnum.YEAR_FIVE },
    { label: '600L', value: LevelsEnum.YEAR_SIX },
  ]);
  activeSegment = signal<ISegmentSwitcher>(this.segments()[0]);

  semesterOptions = signal<{ label: string; value: SemesterEnum }[]>([
    {
      label: '1st Semester',
      value: SemesterEnum.FIRST,
    },
    {
      label: '2nd Semester',
      value: SemesterEnum.SECOND,
    },
    // {
    //   label: '3rd Semester',
    //   value: SemesterEnum.THIRD,
    // },
  ]);

  displayedColumns: string[] = [
    'courseTitle',
    'courseCode',
    'courseLoad',
    'courseCoordinator',
    'assignedAt',
    'action',
  ];

  dataSource = signal<any[]>([]);
  loading = signal<boolean>(false);

  // filter object sent to API
  filter: ICourseQuery = {
    courseCode: '',
    courseTitle: '',
    level: this.activeSegment().value as LevelsEnum,
    semester: '',
    // No paginator on this page — fetch the whole level (backend caps at 100).
    limit: 100,
  };

  constructor() {
    this.route.queryParams.subscribe({
      next: (params) => {
        const level = params['level'] as LevelsEnum;
        if (level) {
          const segment = this.segments()?.find((seg) => seg.value === level);
          if (segment) this.activeSegment.set(segment);
        }
      },
    });
  }

  ngOnInit(): void {
    this.getCourses();
  }

  // Fetch courses
  getCourses() {
    this.loading.set(true);
    this.courseService
      .getCourses(this.filter)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp?.data['courses']) {
            this.dataSource.set(
              resp.data['courses']
                .filter(
                  (course: ICourse) =>
                    course.level === this.activeSegment().label.replace('L', '')
                )
                .map((course: ICourse) => ({
                  ...course,
                  courseCoordinator: course.assignedTo
                    ? `${course.assignedTo.firstname} ${course.assignedTo.lastname}`
                    : null,
                }))
            );
          }
        },
      });
  }

  // Switch segment (100L → 200L etc.)
  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    // update filter.level and refetch
    this.filter.level = this.activeSegment().value as LevelsEnum;
    this.getCourses();
  }

  filterBySemester(value: MatSelectChange) {
    const semseter = value.value as SemesterEnum;
    this.filter.semester = semseter;
    this.getCourses();
  }

  // Navigate to create-course page
  createCourse() {
    this.router.navigate(['../create-course'], {
      relativeTo: this.route,
      queryParams: { level: this.activeSegment().value }, // 👈 pass level
    });
  }

  // Assign coordinator
  assignCourseCoordinator(course: any) {
    this.dialog
      .open(AssignCourseCoordinatorComponent, {
        width: '40%',
        data: {
          courseId: course._id as string,
          courseTitle: course.courseTitle as string,
          courseCode: course.courseCode as string,
        },
      })
      .afterClosed()
      .subscribe({
        next: (resp) => {
          if (resp) this.getCourses();
        },
      });
  }

  // Unassign coordinator
  unassignCourseCoordinator(course: any) {
    this.dialog
      .open(UnassignCourseCordinatorComponent, {
        width: '40%',
        data: {
          courseId: course._id as string,
          lecturerId: course.assignedTo?._id as string,
        },
      })
      .afterClosed()
      .subscribe({
        next: (resp) => {
          if (resp) this.getCourses();
        },
      });
  }
}
