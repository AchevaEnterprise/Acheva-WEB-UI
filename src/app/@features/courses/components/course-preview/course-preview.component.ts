import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-course-preview',
  imports: [DatePipe, TitleCasePipe],
  templateUrl: './course-preview.component.html',
  styleUrl: './course-preview.component.scss',
})
export class CoursePreviewComponent {
  courseTemplate = input<any>();

  template = computed(() => this.courseTemplate());
}
