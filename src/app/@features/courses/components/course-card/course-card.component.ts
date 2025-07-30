import { Component, input, output } from '@angular/core';
import { ICourseTemplate } from '../../models/course.model';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-course-card',
  imports: [ButtonComponent, SvgComponent],
  templateUrl: './course-card.component.html',
  styleUrl: './course-card.component.scss',
})
export class CourseCardComponent {
  courseTemplate = input<Partial<ICourseTemplate>>();
  useTemplateEvent = output<Partial<ICourseTemplate>>();

  createResult() {
    this.useTemplateEvent.emit(this.courseTemplate()!);
  }
}
