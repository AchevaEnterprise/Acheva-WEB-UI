import { Component, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { IResult } from '../../../result-management/models/results.model';

@Component({
  selector: 'app-my-result-grid-card',
  imports: [SvgComponent, MatMenuModule, MatProgressBarModule],
  templateUrl: './my-result-grid-card.component.html',
  styleUrl: './my-result-grid-card.component.scss',
})
export class MyResultGridCardComponent {
  result = input<IResult>();
  viewEvent = output<IResult>();

  viewResult() {
    this.viewEvent.emit(this.result()!);
  }
}
