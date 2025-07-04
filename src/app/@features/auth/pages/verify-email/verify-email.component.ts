import { Component } from '@angular/core';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgBackgroudComponent } from '../../component/svg-backgroud/svg-backgroud.component';

@Component({
  selector: 'app-verify-email',
  imports: [ButtonComponent, SvgBackgroudComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
})
export class VerifyEmailComponent {}
