import { CommonModule } from '@angular/common';
import { Component, Input, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  imports: [CommonModule],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
})
export class StatusBadgeComponent {
  @Input() customStyle: { [klass: string]: any } = {};
  status = input<string>();

  type = input<'pass' | 'fail' | 'active'>();
}
