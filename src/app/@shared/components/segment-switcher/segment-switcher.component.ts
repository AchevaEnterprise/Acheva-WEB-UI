import { NgClass } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RoleAccessDirective } from '../../../@core/directives/role-access.directive';
import { LevelsEnum } from '../../../@core/models/school.model';
import { RoleEnum } from '../../../@features/auth/model/auth.model';

export interface ISegmentSwitcher {
  label: string;
  value:
    | 'DRAFT'
    | 'PENDING'
    | 'UNVERIFIED'
    | 'VERIFIED'
    | 'APPROVED'
    | 'COMPLETE'
    | 'PUBLISHED'
    | 'IMPORTED'
    | 'REGULAR'
    | 'UNREGISTERED'
    | 'REFERENCE'
    | LevelsEnum;
  accessRole?: RoleEnum[];
}

@Component({
  selector: 'app-segment-switcher',
  imports: [NgClass, RoleAccessDirective],
  templateUrl: './segment-switcher.component.html',
  styleUrl: './segment-switcher.component.scss',
})
export class SegmentSwitcherComponent {
  activeSegment = input<ISegmentSwitcher>();
  segments = input<ISegmentSwitcher[]>([]);

  switchEvent = output<ISegmentSwitcher['value']>();

  switchSegment(value: ISegmentSwitcher['value']) {
    this.switchEvent.emit(value);
  }
}
