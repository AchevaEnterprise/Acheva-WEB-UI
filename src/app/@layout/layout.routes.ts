import { Routes } from '@angular/router';
import { LayoutComponent } from './layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: '/dashboard',
      },
      {
        path: 'dashboard',
        data: {
          title: 'Dashboard',
        },
        loadComponent: () =>
          import('../@features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'courses',
        data: {
          title: 'Courses',
        },
        loadComponent: () =>
          import('../@features/courses/courses.component').then(
            (m) => m.CoursesComponent
          ),
      },
      {
        path: 'my-result',
        data: {
          title: 'My Results',
        },
        loadComponent: () =>
          import('../@features/my-results/my-results.component').then(
            (m) => m.MyResultsComponent
          ),
      },
      {
        path: 'result-management',
        data: {
          title: 'Result Management',
        },
        loadComponent: () =>
          import(
            '../@features/result-management/result-management.component'
          ).then((m) => m.ResultManagementComponent),
      },
      {
        path: 'schedule',
        data: {
          title: 'Schedule',
        },
        loadComponent: () =>
          import('../@features/schedule/schedule.component').then(
            (m) => m.ScheduleComponent
          ),
      },
      {
        path: 'notifications',
        data: {
          title: 'Notifications',
        },
        loadComponent: () =>
          import('../@features/notifications/notifications.component').then(
            (m) => m.NotificationsComponent
          ),
      },
      {
        path: 'support',
        data: {
          title: 'Support & Help',
        },
        loadComponent: () =>
          import('../@features/support/support.component').then(
            (m) => m.SupportComponent
          ),
      },
      {
        path: 'user-settings',
        data: {
          title: 'User Settings',
        },
        loadComponent: () =>
          import('../@features/user-settings/user-settings.component').then(
            (m) => m.UserSettingsComponent
          ),
      },
    ],
  },
];
