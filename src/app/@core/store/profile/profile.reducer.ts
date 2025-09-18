import { createReducer, on } from '@ngrx/store';
import {
  IAccount,
  IAuthProfile,
} from '../../../@features/auth/model/auth.model';
import {
  loadProfile,
  loadProfileLinkedAccounts,
  saveLecturerSchool,
  saveProfile,
  saveProfileError,
  saveProfileErrorLinkedAccounts,
  saveProfileLinkedAccounts,
} from './profile.action';
import { ISchool } from '../../models/school.model';

export interface ProfileState {
  info:
    | (Omit<IAuthProfile, 'accessToken' | 'refreshToken'> & {
        schoolInfo?: ISchool;
      })
    | null;
  accounts: IAccount[];
  error: string | null;
  isLoading: boolean;
}

export const initialState: ProfileState = {
  info: null,
  accounts: [],
  error: null,
  isLoading: false,
};

export const profileReducer = createReducer(
  initialState,

  // PROFILE
  on(loadProfile, (state) => ({
    ...state,
    isLoading: true,
  })),
  on(saveProfile, (state, { profile }) => ({
    ...state,
    info: profile,
    isLoading: false,
  })),
  on(saveProfileError, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // Make school name present in profile
  on(saveLecturerSchool, (state, { school }) => ({
    ...state,
    info: {
      ...(state.info as Omit<IAuthProfile, 'accessToken' | 'refreshToken'>),
      schoolInfo: school,
    },
  })),

  // LINKED ACCOUNTS
  on(loadProfileLinkedAccounts, (state) => ({
    ...state,
    isLoading: true,
  })),
  on(saveProfileLinkedAccounts, (state, { accounts }) => ({
    ...state,
    accounts,
    isLoading: false,
  })),
  on(saveProfileErrorLinkedAccounts, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  }))
);
