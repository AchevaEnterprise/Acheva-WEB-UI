import { createSelector } from '@ngrx/store';
import { AppState } from '../app.state';
import { SchoolState } from './school.reducer';

export const selectSchool = (state: AppState) => state.school;

export const schoolLoadingSelector = createSelector(
  selectSchool,
  (state: SchoolState) => state.isLoading
);

export const schoolsSelector = createSelector(
  selectSchool,
  (state: SchoolState) => state.schools
);

export const facultiesSelector = createSelector(
  selectSchool,
  (state: SchoolState) => state.faculties
);

export const departmentsSelector = createSelector(
  selectSchool,
  (state: SchoolState) => state.departments
);
