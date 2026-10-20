import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { SvgComponent } from '../../@shared/components/svg/svg.component';
import { RoleAccessDirective } from '../../@core/directives/role-access.directive';
import { AuthenticationService } from '../auth/service/auth.service';
import { RoleEnum } from '../auth/model/auth.model';

/** One thing a Head can go and administer. */
interface ISettingTile {
  readonly label: string;
  readonly description: string;
  readonly route: string;
  readonly icon: string;
  /** Matched against the search box, so a tile is findable by more than its title. */
  readonly keywords: string;
}

/**
 * Settings — the Head of Department's administration hub.
 *
 * Rebuilt 2026-09-27. The previous version had a bare gradient bar, a 160px
 * avatar and two unlabelled cards on a grey slab: it read as a profile page
 * that happened to have links on it, and the search box above the tiles did
 * nothing. The page is a directory of things a Head can administer, so it is
 * now laid out as one — identity stated once and small, then the tiles, with
 * the search actually filtering them.
 */
@Component({
  selector: 'app-user-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgComponent, RouterLink, RoleAccessDirective],
  templateUrl: './user-settings.component.html',
  styleUrl: './user-settings.component.scss',
})
export class UserSettingsComponent {
  private readonly authService = inject(AuthenticationService);

  readonly activeAccount = this.authService.activeAccount;
  readonly RoleEnum = RoleEnum;

  readonly search = signal('');

  readonly department = computed(
    () => this.activeAccount()?.department?.name ?? null
  );

  /** The personal name on the account, if there is one at all. */
  private readonly personalName = computed(() => {
    const account = this.activeAccount();
    return `${account?.firstname ?? ''} ${account?.lastname ?? ''}`.trim();
  });

  /**
   * What to call the person looking at this page.
   *
   * Office accounts frequently carry no personal name — the same reason the
   * Grade Report and messaging name an office rather than a person. When
   * there is none the DEPARTMENT becomes the heading and the office the
   * subtitle; the first version printed "Head of Department" on both lines,
   * which says nothing twice.
   */
  readonly heading = computed(
    () => this.personalName() || this.department() || 'Head of Department'
  );

  readonly subheading = computed(() => {
    const department = this.department();
    if (!this.personalName()) return 'Head of Department';
    return department
      ? `Head of Department · ${department}`
      : 'Head of Department';
  });

  readonly initials = computed(() =>
    this.heading()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
  );

  private readonly tiles: readonly ISettingTile[] = [
    {
      label: 'Lecturer Management',
      description:
        'Add lecturers, assign Course Advisors and Coordinators, and manage who does what in your department.',
      route: 'hod/lecturer-management',
      icon: 'icons/general/lecturer-management-icon.svg',
      keywords: 'staff lecturer course advisor coordinator roles people',
    },
    {
      label: 'Course Management',
      description:
        'Create courses, set units and assessment shape, and keep the department catalogue current.',
      route: 'hod/course-management',
      icon: 'icons/general/course-management-icon.svg',
      keywords: 'courses catalogue units credit practical curriculum',
    },
    {
      label: 'Payout Account',
      description:
        'The bank account your department’s share of every payment settles to. Dues cannot be collected without it.',
      route: 'hod/payout-account',
      icon: 'icons/menu/dues-management-inactive.svg',
      keywords:
        'bank account payout settlement money paystack subaccount nuban',
    },
    {
      label: 'Departmental Dues',
      description:
        'Set what your department charges for the session and let students pay in up to three instalments.',
      route: 'hod/departmental-dues',
      icon: 'icons/menu/dues-management-inactive.svg',
      keywords: 'dues fees payment money instalments charges naira session',
    },
  ];

  /** Filtered on label, description AND keywords — a Head searching "fees" finds Dues. */
  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.tiles;

    return this.tiles.filter((tile) =>
      `${tile.label} ${tile.description} ${tile.keywords}`
        .toLowerCase()
        .includes(term)
    );
  });
}
