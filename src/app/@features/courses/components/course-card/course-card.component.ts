import { Component, input, output } from '@angular/core';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ICourse, ICourseTemplate } from '../../models/course.model';

@Component({
  selector: 'app-course-card',
  imports: [SvgComponent],
  templateUrl: './course-card.component.html',
  styleUrl: './course-card.component.scss',
})
export class CourseCardComponent {
  course = input<Partial<ICourse>>();
  useTemplateEvent = output<Partial<ICourseTemplate>>();

  createResult() {
    this.useTemplateEvent.emit(this.course()!);
  }
}
