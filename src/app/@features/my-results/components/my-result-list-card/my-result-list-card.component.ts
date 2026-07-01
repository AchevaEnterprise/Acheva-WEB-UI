import { Component, inject, input, output } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IResult } from '../../../result-management/models/results.model';
import { isResultReadonlyForLecturer } from '../../../result-management/utils/workflow';

@Component({
  selector: 'app-my-result-list-card',
  imports: [MatProgressBarModule, MatDividerModule, MatMenuModule],
  templateUrl: './my-result-list-card.component.html',
  styleUrl: './my-result-list-card.component.scss',
})
export class MyResultListCardComponent {
  private readonly authService = inject(AuthenticationService);
  result = input<IResult>();
  viewEvent = output<IResult>();
  deleteEvent = output<string>();

  viewResult() {
    this.viewEvent.emit(this.result()!);
  }

  deleteResult() {
    this.deleteEvent.emit(this.result()?._id!);
  }

  /**
   * A lecturer keeps edit rights only while a result is still a draft in their
   * custody and hasn't been sent. See `isResultReadonlyForLecturer`.
   */
  isViewOnly(): boolean {
    const userRole = this.authService.activeAccount()?.role as RoleEnum;
    return (
      userRole === RoleEnum.LECTURER &&
      isResultReadonlyForLecturer(this.result())
    );
  }
}
