import { Component, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterOutlet } from '@angular/router';
import { UtilityService } from './@core/utility/utility.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatProgressBarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly utils = inject(UtilityService);
}
