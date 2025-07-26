import { RoleEnum } from '../../@features/auth/model/auth.model';

export interface IMenu {
  label: string;
  active_icon: string;
  inactive_icon: string;
  route: string;
  isActive: boolean;
  accessRole: RoleEnum[];
}
