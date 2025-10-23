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
    path: 'verify-result',
    data: {
      title: 'Result Management',
      breadcrumbs: [
        { label: 'My Results', link: '/my-result' },
        { label: 'Results Upload' }
      ]
    },
    loadComponent: () =>
      import(
        './pages/approve-reject-result/approve-reject-result.component'
      ).then((m) => m.ApproveRejectResultComponent),
  },
];
