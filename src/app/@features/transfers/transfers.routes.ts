import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: { title: 'Department Transfers' },
    loadComponent: () =>
      import('./pages/transfers/transfers.component').then(
        (m) => m.TransfersComponent
      ),
  },
  /**
   * Declared BEFORE `:id` — Angular matches in order, so below it `new`
   * would be read as a transfer id and the composer would never open. Same
   * trap as the backend's route ordering.
   */
  {
    path: 'new',
    data: {
      title: 'New Transfer Request',
      breadcrumbs: [
        { label: 'Department Transfers', link: '/transfers' },
        { label: 'New request' },
      ],
    },
    loadComponent: () =>
      import('./pages/transfer-letter/transfer-letter.component').then(
        (m) => m.TransferLetterComponent
      ),
  },
  {
    path: ':id',
    data: {
      title: 'Transfer Request',
      breadcrumbs: [
        { label: 'Department Transfers', link: '/transfers' },
        { label: 'Request' },
      ],
    },
    loadComponent: () =>
      import('./pages/transfer-detail/transfer-detail.component').then(
        (m) => m.TransferDetailComponent
      ),
  },
];
