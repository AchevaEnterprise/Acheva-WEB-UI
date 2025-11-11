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
  {
    path: 'view-results',
    data: {
      title: 'Result Management',
    },
    loadComponent: () =>
      import('./pages/view-results/view-results.component').then(
        (m) => m.ViewResultsComponent
      ),
  },
  {
    path: 'edit-results',
    data: {
      title: 'Result Management',
    },
    loadComponent: () =>
      import('./pages/edit-results/edit-results.component').then(
        (m) => m.EditResultsComponent
      ),
  },
];
