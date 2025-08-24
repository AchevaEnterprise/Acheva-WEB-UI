import { createSelector } from '@ngrx/store';
import { AppState } from '../app.state';
import { SchoolState } from './school.reducer';

export const selectProfile = (state: AppState) => state.school;

export const schoolLoadingSelector = createSelector(
  selectProfile,
  (state: SchoolState) => state.isLoading
);

export const schoolsSelector = createSelector(
  selectProfile,
  (state: SchoolState) => state.schools
);

export const facultiesSelector = createSelector(
  selectProfile,
  (state: SchoolState) => state.faculties
);

export const departmentsSelector = createSelector(
  selectProfile,
  (state: SchoolState) => state.departments
);
