import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { SchoolsService } from '../../services/schools.service';
import {
  loadDepartments,
  loadFaculties,
  loadSchools,
  saveDepartments,
  saveDepartmentsError,
  saveFaculties,
  saveFacultiesError,
  saveSchools,
  saveSchoolsError,
} from './school.action';

@Injectable()
export class SchoolEffects {
  private readonly actions$ = inject(Actions);
  private readonly schoolsService = inject(SchoolsService);

  getSchools$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(loadSchools),
      mergeMap(() =>
        this.schoolsService.getSchools().pipe(
          map((resp) => {
            if (resp.status) return saveSchools({ schools: resp.data });
            else return saveSchoolsError({ error: 'Something went wrong' });
          }),
          catchError((error) =>
            of(saveSchoolsError({ error: error.message as string }))
          )
        )
      )
    );
  });

  getFaculties$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(loadFaculties),
      mergeMap(({ schoolId }) =>
        this.schoolsService.getFaculties(schoolId).pipe(
          map((resp) => {
            if (resp.status) return saveFaculties({ faculties: resp.data });
            else return saveFacultiesError({ error: 'Something went wrong' });
          }),
          catchError((error) =>
            of(saveFacultiesError({ error: error.message as string }))
          )
        )
      )
    );
  });

  getDepartments$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(loadDepartments),
      mergeMap(({ facultyId }) =>
        this.schoolsService.getDepartments(facultyId).pipe(
          map((resp) => {
            if (resp.status) return saveDepartments({ departments: resp.data });
            else return saveDepartmentsError({ error: 'Something went wrong' });
          }),
          catchError((error) =>
            of(saveDepartmentsError({ error: error.message as string }))
          )
        )
      )
    );
  });
}
