import { inject, Pipe, PipeTransform } from '@angular/core';
import { RoleEnum } from '../../@features/auth/model/auth.model';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

@Pipe({
  name: 'resultDisabled',
})
export class ResultDisabledPipe implements PipeTransform {
  private readonly authService = inject(AuthenticationService);

  transform(sent: boolean): boolean {
    const userRole = this.authService.activeAccount()?.role as RoleEnum;

    return (
      (userRole === RoleEnum.LECTURER && sent) ||
      (userRole === RoleEnum.COURSE_COORDINATOR && !sent)
    );
  }
}
