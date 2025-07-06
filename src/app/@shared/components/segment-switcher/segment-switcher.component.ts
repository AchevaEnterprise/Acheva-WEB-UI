import { NgClass } from '@angular/common';
import { Component, input, output } from '@angular/core';

interface ISegmentSwitcher {
  label: string;
  value:
    | 'pending'
    | 'unverified'
    | 'verified'
    | 'published'
    | 'imported'
    | 'regular'
    | 'reference';
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
