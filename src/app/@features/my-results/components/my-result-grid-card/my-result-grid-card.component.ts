import { Component, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-my-result-grid-card',
  imports: [SvgComponent, MatMenuModule, MatProgressBarModule],
  templateUrl: './my-result-grid-card.component.html',
  styleUrl: './my-result-grid-card.component.scss',
})
export class MyResultGridCardComponent {
  viewEvent = output();

  viewResult() {
    this.viewEvent.emit();
  }
}
