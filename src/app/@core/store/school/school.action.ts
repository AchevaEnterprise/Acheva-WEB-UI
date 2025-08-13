import { createAction, props } from '@ngrx/store';
import { IDepartment, IFaculty, ISchool } from '../../models/school.model';

// School
export const loadSchools = createAction('[Schools] Get schools');
export const saveSchools = createAction(
  '[Schools] Save schools successfully',
  props<{ schools: ISchool[] }>()
);
export const saveSchoolsError = createAction(
  '[Schools] Save schools failed',
  props<{ error: string }>()
);

// Faculty
export const loadFaculties = createAction(
  '[Faculty] Get faculties',
  props<{ schoolId: string }>()
);
export const saveFaculties = createAction(
  '[Faculty] Save faculties successfully',
  props<{ faculties: IFaculty[] }>()
);
export const saveFacultiesError = createAction(
  '[Faculty] Save faculties failed',
  props<{ error: string }>()
);

// Department
export const loadDepartments = createAction(
  '[Department] Get departments',
  props<{ facultyId: string }>()
);
export const saveDepartments = createAction(
  '[Department] Save departments successfully',
  props<{ departments: IDepartment[] }>()
);
export const saveDepartmentsError = createAction(
  '[Department] Save departments failed',
  props<{ error: string }>()
);
