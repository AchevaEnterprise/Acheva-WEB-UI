import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { SvgBackgroudComponent } from '../../component/svg-backgroud/svg-backgroud.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-password-reset',
  imports: [
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    SvgComponent,
    ButtonComponent,
    ReactiveFormsModule,
    SvgBackgroudComponent,
  ],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss',
})
export class PasswordResetComponent {
  readonly emailCtrl: FormControl = new FormControl('', [
    Validators.email,
    Validators.required,
  ]);

  goBack() {
    history.back();
  }
}
