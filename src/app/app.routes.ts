import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./@auth/auth.route').then((m) => m.AUTH_ROUTE),
  },
  { path: '**', redirectTo: '' },
];
