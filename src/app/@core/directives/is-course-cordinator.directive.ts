import {
  Directive,
  effect,
  inject,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { AuthenticationService } from '../../@features/auth/service/auth.service';

@Directive({
  selector: '[isCourseAdvisor]',
})
export class IsCourseCordinatorDirective {
  private readonly authService = inject(AuthenticationService);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly templateRef = inject(TemplateRef<any>);

  constructor() {
    effect(() => {
      const account = this.authService.activeAccount();

      this.viewContainer.clear();
      if (account?.role === 'cordinator')
        this.viewContainer.createEmbeddedView(this.templateRef);
    });
  }
}
