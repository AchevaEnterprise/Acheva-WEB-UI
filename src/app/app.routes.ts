import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'auth',
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./@features/auth/auth.route').then((m) => m.routes),
  },
  {
    path: '',
    // canMatch: [authGuard],
    loadChildren: () => import('./@layout/layout.routes').then((m) => m.routes),
  },
  { path: '**', redirectTo: '' },
];
