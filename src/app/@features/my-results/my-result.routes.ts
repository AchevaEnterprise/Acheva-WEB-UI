import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'My Result',
    },
    loadComponent: () =>
      import('./pages/my-results/my-results.component').then(
        (m) => m.MyResultsComponent
      ),
  },
  {
    path: 'upload-result',
    data: {
      title: 'Upload Result',
    },
    loadComponent: () =>
      import('./pages/result-upload/result-upload.component').then(
        (m) => m.ResultUploadComponent
      ),
  },
  {
    path: 'course-coordinator-results',
    data: {
      title: 'Course Coordinator Results View',
    },
    loadComponent: () =>
      import('./pages/course-coordinator-results/course-coordinator-results.component').then(
        (m) => m.CourseCoordinatorResultsComponent
      ),
  },
];
