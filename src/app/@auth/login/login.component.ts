import { Component, signal } from '@angular/core';
import { LoginBannerComponent } from './login-banner/login-banner.component';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRippleModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { SvgComponent } from '../../@core/shared/svg/svg.component';
// import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    LoginBannerComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatRippleModule,
    MatIconModule,
    SvgComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
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
  }

  togglePasswordVisibility(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }
}
