import { RoleEnum } from '../../@features/auth/model/auth.model';
import { IMenu } from '../models/menu.model';

export const MENU: IMenu[] = [
  {
    label: 'Dashboard',
    active_icon: 'icons/menu/dashboard-active.svg',
    inactive_icon: 'icons/menu/dashboard-inactive.svg',
    route: 'dashboard',
    isActive: true,
    accessRole: [
      RoleEnum.DEAN,
      RoleEnum.HOD,
      RoleEnum.COURSE_ADVISOR,
      RoleEnum.COURSE_COORDINATOR,
      RoleEnum.LECTURER,
    ],
  },
  {
    label: 'Courses',
    active_icon: 'icons/menu/courses-active.svg',
    inactive_icon: 'icons/menu/courses-inactive.svg',
    route: 'courses',
    isActive: true,
    accessRole: [
      // RoleEnum.DEAN,
      // RoleEnum.HOD,
      // RoleEnum.COURSE_ADVISOR,
      // RoleEnum.COURSE_COORDINATOR,
      RoleEnum.LECTURER,
    ],
  },
  {
    label: 'My Result',
    active_icon: 'icons/menu/my-result-active.svg',
    inactive_icon: 'icons/menu/my-result-inactive.svg',
    route: 'my-result',
    isActive: true,
    accessRole: [
      // RoleEnum.DEAN,
      // RoleEnum.HOD,
      // RoleEnum.COURSE_ADVISOR,
      // RoleEnum.COURSE_COORDINATOR,
      RoleEnum.LECTURER,
    ],
  },
  {
    label: 'Result Management',
    active_icon: 'icons/menu/result-management-active.svg',
    inactive_icon: 'icons/menu/result-management-inactive.svg',
    route: 'result-management',
    isActive: true,
    accessRole: [
      RoleEnum.DEAN,
      RoleEnum.HOD,
      RoleEnum.COURSE_ADVISOR,
      RoleEnum.COURSE_COORDINATOR,
      RoleEnum.LECTURER,
    ],
  },
  {
    label: 'Messages',
    active_icon: 'icons/menu/messages-active.svg',
    inactive_icon: 'icons/menu/messages-inactive.svg',
    route: 'messages',
    isActive: true,
    // Everyone. Messaging is the one feature with no role boundary at the
    // door — who you may write TO is decided server-side, per conversation.
    accessRole: [
      RoleEnum.DEAN,
      RoleEnum.HOD,
      RoleEnum.COURSE_ADVISOR,
      RoleEnum.COURSE_COORDINATOR,
      RoleEnum.LECTURER,
    ],
  },
  {
    label: 'Students',
    active_icon: 'icons/menu/students-active.svg',
    inactive_icon: 'icons/menu/students-inactive.svg',
    route: 'students',
    isActive: true,
    accessRole: [
      // RoleEnum.DEAN,
      // RoleEnum.HOD,
      RoleEnum.COURSE_ADVISOR,
      // RoleEnum.COURSE_COORDINATOR,
      // RoleEnum.LECTURER,
    ],
  },
  {
    label: 'Registration',
    active_icon: 'icons/menu/courses-active.svg',
    inactive_icon: 'icons/menu/courses-inactive.svg',
    route: 'registration',
    isActive: true,
    accessRole: [RoleEnum.COURSE_ADVISOR],
  },
  {
    label: 'Moderation',
    active_icon: 'icons/menu/result-chart-active.svg',
    inactive_icon: 'icons/menu/result-chart-inactive.svg',
    route: 'moderation',
    isActive: true,
    accessRole: [
      RoleEnum.DEAN,
      RoleEnum.HOD,
      RoleEnum.COURSE_ADVISOR,
      RoleEnum.LECTURER,
    ],
  },
  {
    label: 'History',
    active_icon: 'icons/menu/history-active.svg',
    inactive_icon: 'icons/menu/history-inactive.svg',
    route: 'history',
    isActive: true,
    // Every workflow role keeps a desk trail, so History is open to all five.
    accessRole: [
      RoleEnum.DEAN,
      RoleEnum.HOD,
      RoleEnum.COURSE_ADVISOR,
      RoleEnum.COURSE_COORDINATOR,
      RoleEnum.LECTURER,
    ],
  },
  // {
  //   label: 'Dues Management',
  //   active_icon: 'icons/menu/dues-management-active.svg',
  //   inactive_icon: 'icons/menu/dues-management-inactive.svg',
  //   route: 'dues-management',
  //   isActive: true,
  //   accessRole: [
  //     // RoleEnum.DEAN,
  //     RoleEnum.HOD,
  //     // RoleEnum.COURSE_ADVISOR,
  //     // RoleEnum.COURSE_COORDINATOR,
  //     // RoleEnum.LECTURER,
  //   ],
  // },
  // {
  //   label: 'FAQ',
  //   active_icon: 'icons/menu/faq-inactive.svg',
  //   inactive_icon: 'icons/menu/faq-inactive.svg',
  //   route: 'faq',
  //   isActive: true,
  //   accessRole: [
  //     RoleEnum.DEAN,
  //     RoleEnum.HOD,
  //     RoleEnum.COURSE_ADVISOR,
  //     // RoleEnum.COURSE_COORDINATOR,
  //     // RoleEnum.LECTURER,
  //   ],
  // },
  // {
  //   label: 'Schedule',
  //   active_icon: '',
  //   inactive_icon: '',
  //   route: 'schedule',
  //   isActive: false,
  //   accessRole: [
  //     // RoleEnum.DEAN,
  //     // RoleEnum.HOD,
  //     // RoleEnum.COURSE_ADVISOR,
  //     // RoleEnum.COURSE_COORDINATOR,
  //     RoleEnum.LECTURER,
  //   ],
  // },
  // {
  //   label: 'Notifications',
  //   active_icon: 'icons/menu/notification-inactive.svg',
  //   inactive_icon: 'icons/menu/notification-inactive.svg',
  //   route: 'notifications',
  //   isActive: true,
  //   accessRole: [
  //     // RoleEnum.DEAN,
  //     // RoleEnum.HOD,
  //     // RoleEnum.COURSE_ADVISOR,
  //     RoleEnum.COURSE_COORDINATOR,
  //     RoleEnum.LECTURER,
  //   ],
  // },
  {
    label: 'Support',
    // There is only one support glyph in the catalogue; the active state is
    // carried by the highlighted pill behind it, as it was before this entry
    // was commented out.
    active_icon: 'icons/menu/support-inactive.svg',
    inactive_icon: 'icons/menu/support-inactive.svg',
    route: 'support',
    isActive: true,
    // Every role, without exception: the person who most needs to reach us is
    // whoever is stuck, and gating support by office is how a stuck user ends
    // up emailing a lecturer instead.
    accessRole: [
      RoleEnum.DEAN,
      RoleEnum.HOD,
      RoleEnum.COURSE_ADVISOR,
      RoleEnum.COURSE_COORDINATOR,
      RoleEnum.LECTURER,
    ],
  },
  {
    label: 'User Settings',
    active_icon: 'icons/menu/settings-active.svg',
    inactive_icon: 'icons/menu/settings-inactive.svg',
    route: 'user-settings',
    isActive: true,
    accessRole: [
      // RoleEnum.DEAN,
      RoleEnum.HOD,
      // RoleEnum.COURSE_ADVISOR,
      // RoleEnum.COURSE_COORDINATOR,
      // RoleEnum.LECTURER,
    ],
  },
];
