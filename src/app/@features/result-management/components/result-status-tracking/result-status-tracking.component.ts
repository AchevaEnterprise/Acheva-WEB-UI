import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { IResult } from '../../models/results.model';
import { TimeLineComponent } from './time-line/time-line.component';

@Component({
  selector: 'app-result-status-tracking',
  imports: [MatFormFieldModule, MatSelectModule, TimeLineComponent, DatePipe],
  templateUrl: './result-status-tracking.component.html',
  styleUrl: './result-status-tracking.component.scss',
})
export class ResultStatusTrackingComponent {
  result = input<IResult | null>(null);
}
