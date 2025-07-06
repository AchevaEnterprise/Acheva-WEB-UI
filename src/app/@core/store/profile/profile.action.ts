import { createAction, props } from '@ngrx/store';
import { IAuthProfile } from '../../../@features/auth/model/auth.model';

export const loadProfile = createAction('[Profile] Get profile');
export const saveProfile = createAction(
  '[Profile] Save user profile successfully',
  props<{ profile: IAuthProfile }>()
);
export const saveProfileError = createAction(
  '[Profile] Save user profile failed',
  props<{ error: string }>()
);
