import { createAction, props } from '@ngrx/store';
import {
  IAccount,
  IAuthProfile,
} from '../../../@features/auth/model/auth.model';

// PROFILE
export const loadProfile = createAction('[Profile] Get user profile');
export const saveProfile = createAction(
  '[Profile] Save user profile successfully',
  props<{ profile: Omit<IAuthProfile, 'accessToken' | 'refreshToken'> }>()
);
export const saveProfileError = createAction(
  '[Profile] Save user profile failed',
  props<{ error: string }>()
);

// LINKED ACCOUNTS
export const loadProfileLinkedAccounts = createAction(
  '[Profile] Get user linked accounts'
);
export const saveProfileLinkedAccounts = createAction(
  '[Profile] Save user linked account successfully',
  props<{ accounts: IAccount[] }>()
);
export const saveProfileErrorLinkedAccounts = createAction(
  '[Profile] Save user linked account failed',
  props<{ error: string }>()
);
