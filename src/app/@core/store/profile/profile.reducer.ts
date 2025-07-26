import { createReducer, on } from '@ngrx/store';
import {
  IAccount,
  IAuthProfile,
} from '../../../@features/auth/model/auth.model';
import {
  loadProfile,
  loadProfileLinkedAccounts,
  saveProfile,
  saveProfileError,
  saveProfileErrorLinkedAccounts,
  saveProfileLinkedAccounts,
} from './profile.action';

export interface ProfileState {
  profile: Omit<IAuthProfile, 'accessToken' | 'refreshToken'> | null;
  accounts: IAccount[];
  error: string | null;
  isLoading: boolean;
}

export const initialState: ProfileState = {
  profile: null,
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
    profile,
    isLoading: false,
  })),
  on(saveProfileError, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
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
