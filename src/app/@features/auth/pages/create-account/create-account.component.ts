import { Component, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { MatRippleModule } from '@angular/material/core';
import {
  MatFormFieldModule,
  MatPrefix,
  MatSuffix,
} from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { AuthBannerComponent } from '../../component/auth-banner/auth-banner.component';
import { PasswordValidityComponent } from '../../component/password-validity/password-validity.component';

@Component({
  selector: 'app-create-account',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatRippleModule,
    MatIconModule,
    MatSelectModule,
    SvgComponent,
    AuthBannerComponent,
    MatSuffix,
    MatPrefix,
    ButtonComponent,
    PasswordValidityComponent,
  ],
  templateUrl: './create-account.component.html',
  styleUrl: './create-account.component.scss',
})
export class CreateAccountComponent {
  form: FormGroup = new FormGroup({
    fullname: new FormControl(null, Validators.required),
    email: new FormControl(null, Validators.required),
    search: new FormControl(null, Validators.required),
    faculty: new FormControl(null, Validators.required),
    department: new FormControl(null, Validators.required),
    title: new FormControl(null, Validators.required),
    role: new FormControl(null, Validators.required),
    password: new FormControl(null, Validators.required),
    confirm_password: new FormControl(null, Validators.required),
  });

  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);

  togglePasswordVisibility() {
    this.showPassword.update((val) => !val);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update((val) => !val);
  }

  submitForm() {
    console.warn(this.form.value);
  }
}
