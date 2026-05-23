import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'Moderation',
    },
    loadComponent: () =>
      import('./pages/moderations/moderations.component').then(
        (m) => m.ModerationsComponent
      ),
  },
  {
    path: ':id',
    data: {
      title: 'Moderation Detail',
      breadcrumbs: [
        { label: 'Moderation', link: '/moderation' },
        { label: 'Detail' },
      ],
    },
    loadComponent: () =>
      import('./pages/moderation-detail/moderation-detail.component').then(
        (m) => m.ModerationDetailComponent
      ),
  },
];
