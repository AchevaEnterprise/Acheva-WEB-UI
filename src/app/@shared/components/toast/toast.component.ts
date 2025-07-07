import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarAction,
  MatSnackBarActions,
  MatSnackBarLabel,
  MatSnackBarRef,
} from '@angular/material/snack-bar';
import { IAppNotification } from '../../../@core/models/notification.model';
import { SvgComponent } from '../svg/svg.component';

@Component({
  selector: 'app-toast',
  imports: [
    MatProgressBarModule,
    MatButtonModule,
    MatSnackBarAction,
    MatSnackBarActions,
    MatSnackBarLabel,
    SvgComponent,
  ],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  snackBarRef = inject(MatSnackBarRef);
  progress = signal<number>(0);

  public readonly data: IAppNotification = inject(
    MAT_SNACK_BAR_DATA
  ) as IAppNotification;

  ngOnInit() {
    const duration = 5000;
    const intervalTime = 100;
    const increment = 100 / (duration / intervalTime);

    const interval = setInterval(() => {
      this.progress.update((progress) => {
        const next = progress + increment;
        return next > 100 ? 100 : next;
      });

      if (this.progress() >= 100) clearInterval(interval);
    }, intervalTime);
  }
}
