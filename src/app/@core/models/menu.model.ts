export interface IMenu {
  label: string;
  active_icon: string;
  inactive_icon: string;
  route: string;
  isActive: boolean;
  has_sub_menu: boolean;
  sub_menu?: IMenu;
}
