import { NgClass } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RoleEnum } from '../../../@features/auth/model/auth.model';

export interface ISegmentSwitcher {
  label: string;
  value:
    | 'drafts'
    | 'pending'
    | 'unverified'
    | 'verified'
    | 'published'
    | 'imported'
    | 'regular'
    | 'reference';
  roleAccess: RoleEnum | RoleEnum[];
}

@Component({
  selector: 'app-segment-switcher',
  imports: [NgClass],
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
