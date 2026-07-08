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
        loadChildren: () =>
          import('../@features/courses/course.routes').then((m) => m.routes),
      },
      {
        path: 'my-result',
        loadChildren: () =>
          import('../@features/my-results/my-result.routes').then(
            (m) => m.routes
          ),
      },
      {
        path: 'result-management',
        loadChildren: () =>
          import(
            '../@features/result-management/result-management.routes'
          ).then((m) => m.routes),
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
        loadChildren: () =>
          import('../@features/user-settings/user-settings.routes').then(
            (m) => m.routes
          ),
      },
      {
        path: 'history',
        data: {
          title: 'History',
        },
        loadComponent: () =>
          import('../@features/history/pages/history/history.component').then(
            (m) => m.HistoryComponent
          ),
      },
      {
        path: 'students',
        data: {
          title: 'Students',
        },
        loadChildren: () =>
          import('../@features/students/students.routes').then((m) => m.routes),
      },
      {
        path: 'registration',
        data: {
          title: 'Course Registration',
        },
        loadChildren: () =>
          import('../@features/registration/registration.routes').then(
            (m) => m.routes
          ),
      },
      {
        path: 'moderation',
        data: {
          title: 'Moderation',
        },
        loadChildren: () =>
          import('../@features/moderation/moderation.routes').then(
            (m) => m.routes
          ),
      },
      {
        path: 'dues-management',
        data: {
          title: 'Dues Management',
        },
        loadComponent: () =>
          import(
            '../@features/dues-management/pages/dues-management/dues-management.component'
          ).then((m) => m.DuesManagementComponent),
      },
    ],
  },
];
