import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  imports: [],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  iconSrc = input<string>('images/general/empty-doc.svg');
  description = input<string>('No records exist...');
}
