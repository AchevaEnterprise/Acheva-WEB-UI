import { inject, Pipe, PipeTransform } from '@angular/core';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

@Pipe({
  name: 'resultApprovedForMe',
})
export class ResultApprovedForMePipe implements PipeTransform {
  private readonly authService = inject(AuthenticationService);

  transform(rejectedBy: string[] | null | undefined): boolean {
    const userId = this.authService.activeAccount()?.id;
    // Older and imported results carry no `rejectedBy` array at all.
    return (rejectedBy ?? []).includes(userId!);
  }
}
