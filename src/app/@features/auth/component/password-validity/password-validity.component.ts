import { Component, computed, input } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-password-validity',
  imports: [MatProgressBarModule, MatMenuModule, SvgComponent],
  templateUrl: './password-validity.component.html',
  styleUrl: './password-validity.component.scss',
})
export class PasswordValidityComponent {
  password = input<string>('');
  validity = computed(() => {
    const value = this.password() ?? '';
    return {
      contains1UpperCase: /[A-Z]/.test(value),
      contains1Number: /\d/.test(value),
      min8Characters: value.length >= 8,
    };
  });
}
