import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
} from '@angular/core';
import { RoleEnum } from '../../@features/auth/model/auth.model';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

@Directive({
  selector: '[appRoleAccess]',
  standalone: true,
})
export class RoleAccessDirective {
  private readonly authService = inject(AuthenticationService);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly templateRef = inject(TemplateRef<any>);

  private readonly allowedRoles: RoleEnum[] = [
    RoleEnum.DEAN,
    RoleEnum.HOD,
    RoleEnum.COURSE_ADVISOR,
    RoleEnum.COURSE_COORDINATOR,
    RoleEnum.LECTURER,
  ];

  private rolesToMatch: RoleEnum[] = [];

  @Input()
  set appRoleAccess(value: RoleEnum[]) {
    if (!value) return;

    this.rolesToMatch = value;
    this.updateView();
  }

  constructor() {
    effect(() => {
      this.updateView();
    });
  }

  private updateView() {
    this.viewContainer.clear();
    const account = this.authService.activeAccount();
    if (!account || (account && !account.role)) return;

    const hasAccess =
      this.allowedRoles.includes(account.role) &&
      this.rolesToMatch.includes(account.role);

    if (hasAccess) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
