import { createSelector } from '@ngrx/store';
import { AppState } from '../app.state';
import { ProfileState } from './profile.reducer';

export const selectProfile = (state: AppState) => state.profile;

export const profileLoadingSelector = createSelector(
  selectProfile,
  (state: ProfileState) => state.isLoading
);

export const profileSelector = createSelector(
  selectProfile,
  (state: ProfileState) => state.profile
);
