import { Component, input, output } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { IResult } from '../../../result-management/models/results.model';

@Component({
  selector: 'app-my-result-list-card',
  imports: [MatProgressBarModule, MatDividerModule, MatMenuModule],
  templateUrl: './my-result-list-card.component.html',
  styleUrl: './my-result-list-card.component.scss',
})
export class MyResultListCardComponent {
  result = input<IResult>();
  viewEvent = output<IResult>();
  deleteEvent = output<string>();

  viewResult() {
    this.viewEvent.emit(this.result()!);
  }

  deleteResult() {
    this.deleteEvent.emit(this.result()?._id!);
  }
}
