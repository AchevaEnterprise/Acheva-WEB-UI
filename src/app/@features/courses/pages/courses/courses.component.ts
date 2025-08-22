import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map, Observable } from 'rxjs';
import { COURSE_TEMPLATE } from '../../../../@core/constant/course-template-mock';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { CourseCardComponent } from '../../components/course-card/course-card.component';
import { ICourse, ICourseTemplate } from '../../models/course.model';
import { CoursesService } from '../../services/courses.service';

@Component({
  selector: 'app-courses',
  imports: [
    SvgComponent,
    SearchInputComponent,
    CardComponent,
    EmptyStateComponent,
    MatDivider,
    CourseCardComponent,
    RouterLink,
    LoaderComponent,
    AsyncPipe,
    NgIf,
  ],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
})
export class CoursesComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthenticationService);
  private readonly courseService = inject(CoursesService);

  courseTemplates = signal<Partial<ICourseTemplate>[]>(COURSE_TEMPLATE);
  RoleEnum = RoleEnum;
  activeAccount = this.authService.activeAccount;

  isloadingRecentCourses = signal(true);
  recentCourses$: Observable<ICourse[]> = this.courseService
    .getRecentCourses()
    .pipe(
      map((resp) => resp.data),
      finalize(() => this.isloadingRecentCourses.set(false))
    );

  isloadingCourses = signal(true);
  courses$: Observable<ICourse[]> = this.courseService.getCourses().pipe(
    map((resp) => resp.data.courses),
    finalize(() => this.isloadingCourses.set(false))
  );

  createNewResult() {
    this.router.navigate(['details'], {
      relativeTo: this.route,
      queryParams: { new: true },
    });
  }

  createResult(course: Partial<ICourse>) {
    this.router.navigate(['details'], {
      relativeTo: this.route,
      queryParams: { courseId: course._id },
    });
  }
}
