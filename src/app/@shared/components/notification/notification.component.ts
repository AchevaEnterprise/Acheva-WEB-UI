import { Component, inject, OnInit, signal } from '@angular/core';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarAction,
  MatSnackBarActions,
  MatSnackBarLabel,
  MatSnackBarRef,
} from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { SvgComponent } from '../svg/svg.component';
import { IAppNotification } from '../../../@core/models/notification.model';

@Component({
  selector: 'app-notification',
  imports: [
    MatProgressBarModule,
    MatButtonModule,
    MatSnackBarAction,
    MatSnackBarActions,
    MatSnackBarLabel,
    SvgComponent,
  ],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.scss',
})
export class NotificationComponent implements OnInit {
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
