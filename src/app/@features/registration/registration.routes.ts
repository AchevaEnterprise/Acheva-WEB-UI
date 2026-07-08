import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'Course Registration',
    },
    loadComponent: () =>
      import('./pages/registrations/registrations.component').then(
        (m) => m.RegistrationsComponent
      ),
  },
  {
    path: ':id',
    data: {
      title: 'Registration Detail',
      breadcrumbs: [
        { label: 'Course Registration', link: '/registration' },
        { label: 'Detail' },
      ],
    },
    loadComponent: () =>
      import('./pages/registration-detail/registration-detail.component').then(
        (m) => m.RegistrationDetailComponent
      ),
  },
];
