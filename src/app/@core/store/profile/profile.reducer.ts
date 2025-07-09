import { createReducer, on } from '@ngrx/store';
import { IAuthProfile } from '../../../@features/auth/model/auth.model';
import { loadProfile, saveProfile, saveProfileError } from './profile.action';

export interface ProfileState {
  profile: IAuthProfile | null;
  isLoading: boolean;
}

export const initialState: ProfileState = {
  profile: null,
  isLoading: false,
};

export const profileReducer = createReducer(
  initialState,
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
  }))
);
