import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'Students',
    },
    loadComponent: () =>
      import('./pages/students/students.component').then(
        (m) => m.StudentsComponent
      ),
  },
  {
    path: ':regNo/result',
    data: {
      title: 'Student Result',
    },
    loadComponent: () =>
      import('./pages/student-result/student-result.component').then(
        (m) => m.StudentResultComponent
      ),
  },
];
