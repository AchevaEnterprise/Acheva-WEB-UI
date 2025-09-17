import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, filter, map, mergeMap } from 'rxjs/operators';
import { IAuthProfile } from '../../../@features/auth/model/auth.model';
import { AuthenticationService } from '../../../@features/auth/service/auth.service';
import {
  loadLecturerSchool,
  loadProfile,
  loadProfileLinkedAccounts,
  saveLecturerSchool,
  saveProfile,
  saveProfileError,
  saveProfileErrorLinkedAccounts,
  saveProfileLinkedAccounts,
} from './profile.action';
import { SchoolsService } from '../../services/schools.service';
import { saveSchoolsError } from '../school/school.action';

@Injectable()
export class ProfileEffects {
  private readonly actions$ = inject(Actions);
  private readonly authService = inject(AuthenticationService);
  private readonly schoolsService = inject(SchoolsService);

  getProfile$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(loadProfile),
      mergeMap(() =>
        this.authService.getProfile().pipe(
          map((resp: any) => {
            console.log('Loading profile');
            if (resp.status)
              return saveProfile({ profile: resp.data as IAuthProfile });
            else return saveProfileError({ error: resp.message as string });
          }),
          catchError((error) =>
            of(saveProfileError({ error: error.message as string }))
          )
        )
      )
    );
  });

  // Listen to successful profile save and trigger school loading
  loadSchoolOnProfileSave$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(saveProfile), // ← Listen to the action
      filter(({ profile }) => !!profile?.school),
      map(({ profile }) => loadLecturerSchool({ schoolId: profile.school! }))
    );
  });

  getLecturerSchool$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(loadLecturerSchool),
      mergeMap(({ schoolId }) =>
        this.schoolsService.getSchoolById(schoolId).pipe(
          map((resp) => {
            if (resp.status) {
              return saveLecturerSchool({ school: resp.data });
            } else {
              return saveSchoolsError({ error: 'Something went wrong' });
            }
          }),
          catchError((error) =>
            of(saveSchoolsError({ error: error.message as string }))
          )
        )
      )
    );
  });

  getLinkedAccounts$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(loadProfileLinkedAccounts),
      mergeMap(() =>
        this.authService.getLinkedAccounts().pipe(
          map((resp) => {
            if (resp.status)
              return saveProfileLinkedAccounts({
                accounts: resp.data,
              });
            else
              return saveProfileErrorLinkedAccounts({
                error: 'Error fetching linked accounts',
              });
          }),
          catchError((error) =>
            of(
              saveProfileErrorLinkedAccounts({ error: error.message as string })
            )
          )
        )
      )
    );
  });
}
