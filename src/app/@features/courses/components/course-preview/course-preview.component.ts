import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-course-preview',
  imports: [DatePipe],
  templateUrl: './course-preview.component.html',
  styleUrl: './course-preview.component.scss',
})
export class CoursePreviewComponent {
  courseTemplate = input<any>();

  template = computed(() => this.courseTemplate());
}
