import { Routes } from '@angular/router';

export const AUTH_ROUTE: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
    data: {
      title: 'Login',
      description: 'Login to your account',
    },
  },
  {
    path: 'create-account',
    loadComponent: () =>
      import('./create-account/create-account.component').then(
        (m) => m.CreateAccountComponent
      ),
    data: {
      title: 'Create Account',
      description: 'Create a new account',
    },
  },
];
