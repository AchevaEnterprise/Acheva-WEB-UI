import { createReducer, on } from '@ngrx/store';
import { IDepartment, IFaculty, ISchool } from '../../models/school.model';
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

export interface SchoolState {
  schools: ISchool[];
  faculties: IFaculty[];
  departments: IDepartment[];
  error: string | null;
  isLoading: boolean;
}

export const initialState: SchoolState = {
  schools: [],
  faculties: [],
  departments: [],
  error: null,
  isLoading: false,
};

export const schoolReducer = createReducer(
  initialState,

  // Schools
  on(loadSchools, (state) => ({
    ...state,
    isLoading: true,
  })),
  on(saveSchools, (state, { schools }) => ({
    ...state,
    schools,
    isLoading: false,
  })),
  on(saveSchoolsError, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // Faculties
  on(loadFaculties, (state) => ({
    ...state,
    isLoading: true,
  })),
  on(saveFaculties, (state, { faculties }) => ({
    ...state,
    faculties,
    isLoading: false,
  })),
  on(saveFacultiesError, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // Departments
  on(loadDepartments, (state) => ({
    ...state,
    isLoading: true,
  })),
  on(saveDepartments, (state, { departments }) => ({
    ...state,
    departments,
    isLoading: false,
  })),
  on(saveDepartmentsError, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  }))
);
