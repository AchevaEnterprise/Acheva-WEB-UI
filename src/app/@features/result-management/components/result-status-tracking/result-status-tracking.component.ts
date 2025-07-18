import { Component } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TimeLineComponent } from './time-line/time-line.component';

@Component({
  selector: 'app-result-status-tracking',
  imports: [MatFormFieldModule, MatSelectModule, TimeLineComponent],
  templateUrl: './result-status-tracking.component.html',
  styleUrl: './result-status-tracking.component.scss',
})
export class ResultStatusTrackingComponent {}
