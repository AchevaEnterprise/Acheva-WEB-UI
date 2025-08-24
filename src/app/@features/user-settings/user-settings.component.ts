import { Component, inject } from '@angular/core';
import { SearchInputComponent } from '../../@shared/components/forms/search-input/search-input.component';
import { SvgComponent } from '../../@shared/components/svg/svg.component';
import { AuthenticationService } from '../auth/service/auth.service';
import { RouterLink } from '@angular/router';
import { ImageFallbackDirective } from '../../@core/directives/image-fallback.directive';
import { RoleAccessDirective } from '../../@core/directives/role-access.directive';
import { RoleEnum } from '../auth/model/auth.model';

@Component({
  selector: 'app-user-settings',
  imports: [
    SvgComponent,
    SearchInputComponent,
    RouterLink,
    ImageFallbackDirective,
    RoleAccessDirective,
  ],
  templateUrl: './user-settings.component.html',
  styleUrl: './user-settings.component.scss',
})
export class UserSettingsComponent {
  private readonly authService = inject(AuthenticationService);
  activeAccount = this.authService.activeAccount;

  RoleEnum = RoleEnum;
}
