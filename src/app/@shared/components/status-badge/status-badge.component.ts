import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  imports: [],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
})
export class StatusBadgeComponent {
  status = input<string>();
  lowercaseStatus = computed(() => this.status()?.toLocaleLowerCase());
}
