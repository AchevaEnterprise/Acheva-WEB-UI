import { Component, inject, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ResultDisabledPipe } from '../../../../@core/pipes/result-disabled.pipe';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IResult } from '../../../result-management/models/results.model';

@Component({
  selector: 'app-my-result-grid-card',
  imports: [
    SvgComponent,
    MatMenuModule,
    MatProgressBarModule,
    ResultDisabledPipe,
  ],
  templateUrl: './my-result-grid-card.component.html',
  styleUrl: './my-result-grid-card.component.scss',
})
export class MyResultGridCardComponent {
  private readonly authService = inject(AuthenticationService);
  result = input<IResult>();
  viewEvent = output<IResult>();
  deleteEvent = output<string>();

  viewResult() {
    if (this.isResultDisabled()) return;
    this.viewEvent.emit(this.result()!);
  }

  deleteResult() {
    this.deleteEvent.emit(this.result()?._id!);
  }

  isResultDisabled(): boolean {
    const userRole = this.authService.activeAccount()?.role as RoleEnum;
    return userRole === RoleEnum.LECTURER && this.result()!.hasBeenSent;
  }
}
