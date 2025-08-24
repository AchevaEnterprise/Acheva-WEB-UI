import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'Courses',
    },
    loadComponent: () =>
      import('./pages/courses/courses.component').then(
        (m) => m.CoursesComponent
      ),
  },
  {
    path: 'details',
    data: {
      title: 'Course Details',
    },
    loadComponent: () =>
      import('./pages/course-details/course-details.component').then(
        (m) => m.CourseDetailsComponent
      ),
  },
];
