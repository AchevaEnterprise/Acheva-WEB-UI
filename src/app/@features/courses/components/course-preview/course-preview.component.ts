import { TitleCasePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-course-preview',
  imports: [TitleCasePipe],
  templateUrl: './course-preview.component.html',
  styleUrl: './course-preview.component.scss',
})
export class CoursePreviewComponent {
  courseTemplate = input<any>();
  template = computed(() => this.courseTemplate());

  courseCode = computed(() => {
    if (typeof this.template().courseCode === 'string') {
      return this.template().courseCode;
    } else {
      return this.template().courseCode?.courseCode;
    }
  });
}
