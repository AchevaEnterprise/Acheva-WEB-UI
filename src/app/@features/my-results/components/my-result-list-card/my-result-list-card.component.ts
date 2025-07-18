import { Component, output } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-my-result-list-card',
  imports: [
    SvgComponent,
    MatProgressBarModule,
    MatDividerModule,
    MatMenuModule,
  ],
  templateUrl: './my-result-list-card.component.html',
  styleUrl: './my-result-list-card.component.scss',
})
export class MyResultListCardComponent {
  viewEvent = output();

  viewResult() {
    this.viewEvent.emit();
  }
}
