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
];
