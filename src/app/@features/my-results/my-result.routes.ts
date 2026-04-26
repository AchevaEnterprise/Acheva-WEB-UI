import { Routes } from '@angular/router';
import { PendingChangesGuard } from '../../@core/guards/pending-changes.guard';

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
  {
    path: 'upload-result',
    data: {
      title: 'Upload Result',
    },
    canDeactivate: [PendingChangesGuard],
    loadComponent: () =>
      import('./pages/result-upload/result-upload.component').then(
        (m) => m.ResultUploadComponent
      ),
  },
];
