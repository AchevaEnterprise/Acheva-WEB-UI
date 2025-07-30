import { Component, inject, signal } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { COURSE_TEMPLATE } from '../../../../@core/constant/course-template-mock';
import { ICourseTemplate } from '../../models/course.model';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { CourseCardComponent } from '../../components/course-card/course-card.component';

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
  ],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
})
export class CoursesComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  courseTemplates = signal<Partial<ICourseTemplate>[]>(COURSE_TEMPLATE);

  createResult(courseTemplate: Partial<ICourseTemplate>) {
    this.router.navigate(['details', 1], {
      relativeTo: this.route,
    });
  }
}
