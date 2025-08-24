import { ProfileState } from './profile/profile.reducer';
import { SchoolState } from './school/school.reducer';

export interface AppState {
  profile: ProfileState;
  school: SchoolState;
}
