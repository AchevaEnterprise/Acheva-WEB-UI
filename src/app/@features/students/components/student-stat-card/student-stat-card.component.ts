import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type StudentStatAccent = 'amber' | 'green' | 'purple' | 'indigo';

@Component({
  selector: 'app-student-stat-card',
  imports: [MatIconModule],
  templateUrl: './student-stat-card.component.html',
  styleUrl: './student-stat-card.component.scss',
})
export class StudentStatCardComponent {
  label = input.required<string>();
  value = input<string | number>('—');
  icon = input.required<string>();
  accent = input<StudentStatAccent>('indigo');

  // Each accent maps to a tinted background + foreground pair for the icon
  // chip. Centralizing this keeps the card visually consistent and trivial
  // to extend with new accents later.
  accentClass = computed(() => `accent-${this.accent()}`);
}
