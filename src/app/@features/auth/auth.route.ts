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
      import('./pages/login/login.component').then((m) => m.LoginComponent),
    data: {
      title: 'Login',
      description: 'Login to your account',
    },
  },
  {
    path: 'create-account',
    loadComponent: () =>
      import('./pages/create-account/create-account.component').then(
        (m) => m.CreateAccountComponent
      ),
    data: {
      title: 'Create Account',
      description: 'Create a new account',
    },
  },
  {
    path: 'password-reset',
    loadComponent: () =>
      import('./pages/password-reset/password-reset.component').then(
        (m) => m.PasswordResetComponent
      ),
    data: {
      title: 'Reset Password',
      description: 'Reset your password',
    },
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./pages/verify-email/verify-email.component').then(
        (m) => m.VerifyEmailComponent
      ),
    data: {
      title: 'Verify Email',
      description: 'Verify your email',
    },
  },
  {
    path: 'confirm-email',
    loadComponent: () =>
      import('./pages/confirm-email/confirm-email.component').then(
        (m) => m.ConfirmEmailComponent
      ),
    data: {
      title: 'Confirm Email',
      description: 'Confirm your email',
    },
  },
  {
    path: 'create-password',
    loadComponent: () =>
      import('./pages/create-new-password/create-new-password.component').then(
        (m) => m.CreateNewPasswordComponent
      ),
    data: {
      title: 'Create New Password',
      description: 'Create your new password',
    },
  },
];
