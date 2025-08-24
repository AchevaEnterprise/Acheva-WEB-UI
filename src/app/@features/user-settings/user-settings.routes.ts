import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { RoleEnum } from '../auth/model/auth.model';
import { AuthenticationService } from '../auth/service/auth.service';

export const routes: Routes = [
  {
    path: 'path',
    redirectTo: () => {
      const authService = inject(AuthenticationService);
      const role = authService.activeAccount()?.role;

      switch (role) {
        case RoleEnum.HOD: {
          return 'hod';
        }
        default:
          return '';
      }
    },
    pathMatch: 'full',
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./user-settings.component').then((m) => m.UserSettingsComponent),
  },
  {
    path: 'hod',
    data: {
      title: 'Settings',
    },
    loadComponent: () =>
      import('./pages/hod-settings/hod-settings.component').then(
        (m) => m.HodSettingsComponent
      ),
    children: [
      {
        path: 'lecturer-management',
        data: {
          title: 'Lecturer Management',
        },
        loadComponent: () =>
          import(
            './pages/hod-settings/lecturer-management/lecturer-management.component'
          ).then((m) => m.LecturerManagementComponent),
      },
      {
        path: 'course-management',
        data: {
          title: 'Course Management',
        },
        loadComponent: () =>
          import(
            './pages/hod-settings/course-management/course-management.component'
          ).then((m) => m.CourseManagementComponent),
      },
      {
        path: 'create-course',
        data: {
          title: 'Course Management',
        },
        loadComponent: () =>
          import(
            './pages/hod-settings/course-management/create-course/create-course.component'
          ).then((m) => m.CreateCourseComponent),
      },
    ],
  },
];
