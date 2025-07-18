import { Component, input } from '@angular/core';
import { ICourseTemplate } from '../../models/course.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-course-preview',
  imports: [DatePipe],
  templateUrl: './course-preview.component.html',
  styleUrl: './course-preview.component.scss',
})
export class CoursePreviewComponent {
  courseTemplate = input<ICourseTemplate>();
}
