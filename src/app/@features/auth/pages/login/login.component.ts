import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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
import { Router, RouterLink } from '@angular/router';
import { AuthBannerComponent } from '../../component/auth-banner/auth-banner.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    RouterLink,
    AuthBannerComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatRippleModule,
    MatIconModule,
    SvgComponent,
    MatPrefix,
    MatSuffix,
    ButtonComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly router = inject(Router);

  userForm: FormGroup = new FormGroup({
    email: new FormControl(null, [Validators.required]),
    password: new FormControl(null, [Validators.required]),
  });

  hide = signal(true);

  get userEmail() {
    return this.userForm.controls['email'].value;
  }

  get userPassword() {
    return this.userForm.controls['password'].value;
  }

  patchFormValue(key: string, value: string) {
    this.userForm.patchValue({ [key]: value }, { emitEvent: false });
  }

  submitForm() {
    console.warn(this.userForm.value);
    this.router.navigate(['/dashboard']);
  }

  togglePasswordVisibility(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }
}
