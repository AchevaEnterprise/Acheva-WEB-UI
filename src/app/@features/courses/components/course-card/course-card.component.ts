import { Component, input, output } from '@angular/core';
import { ICourse, ICourseTemplate } from '../../models/course.model';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-course-card',
  imports: [ButtonComponent, SvgComponent],
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
