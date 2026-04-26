import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { NotificationService } from '../../../@features/notifications/service/notification.service';
import {
  loadNotification,
  saveNotification,
  saveNotificationError,
} from './notification.action';

@Injectable()
export class NotificationEffects {
  private readonly actions$ = inject(Actions);
  private readonly notificationService = inject(NotificationService);

  getNotifications$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(loadNotification),
      mergeMap(() =>
        this.notificationService.getNotifications().pipe(
          map((resp) => {
            if (resp.status)
              return saveNotification({ notifications: resp.data });
            else return saveNotificationError({ error: resp.message });
          }),
          catchError((error) =>
            of(saveNotificationError({ error: error.message as string }))
          )
        )
      )
    );
  });
}
