import { Component, input } from '@angular/core';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-auth-banner',
  imports: [SvgComponent],
  templateUrl: './auth-banner.component.html',
  styleUrl: './auth-banner.component.scss',
})
export class AuthBannerComponent {
  title = input<string>('');
  description = input<string>('');
}
