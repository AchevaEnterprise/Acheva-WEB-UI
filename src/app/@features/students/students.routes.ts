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
    path: ':regNo/carryovers',
    data: {
      title: 'Carryovers',
      breadcrumbs: [
        { label: 'Students', link: '/students' },
        { label: 'Carryovers' },
      ],
    },
    loadComponent: () =>
      import('./pages/student-carryovers/student-carryovers.component').then(
        (m) => m.StudentCarryoversComponent
      ),
  },
  {
    path: ':regNo/moderate/:courseId',
    data: {
      title: 'Moderation',
      breadcrumbs: [
        { label: 'Students', link: '/students' },
        { label: 'Moderation' },
      ],
    },
    loadComponent: () =>
      import('./pages/create-moderation/create-moderation.component').then(
        (m) => m.CreateModerationComponent
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
  {
    path: ':regNo',
    data: {
      title: 'Profile',
      breadcrumbs: [
        { label: 'Students', link: '/students' },
        { label: 'Profile' },
      ],
    },
    loadComponent: () =>
      import('./pages/student-profile/student-profile.component').then(
        (m) => m.StudentProfileComponent
      ),
  },
];
