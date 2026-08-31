import { Component, computed, input } from '@angular/core';

/**
 * `tone` overrides the keyword auto-mapping below. Callers with a vocabulary
 * the keywords don't cover (workflow actions, moderation statuses) pass their
 * own tone; everything else keeps the pass/fail behaviour unchanged.
 */
export type StatusBadgeTone = 'brand' | 'positive' | 'negative' | 'neutral';

@Component({
  selector: 'app-status-badge',
  imports: [],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
})
export class StatusBadgeComponent {
  status = input<string>();
  tone = input<StatusBadgeTone>();

  lowercaseStatus = computed(() => this.status()?.toLocaleLowerCase());

  resolvedTone = computed<StatusBadgeTone>(() => {
    const explicit = this.tone();
    if (explicit) return explicit;

    const status = this.lowercaseStatus();
    if (status === 'pass' || status === 'active') return 'positive';
    if (status === 'fail' || status === 'inactive') return 'negative';
    return 'neutral';
  });
}
