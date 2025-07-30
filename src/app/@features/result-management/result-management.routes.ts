import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'Result Management',
    },
    loadComponent: () =>
      import('./pages/result-management/result-management.component').then(
        (m) => m.ResultManagementComponent
      ),
  },
];
