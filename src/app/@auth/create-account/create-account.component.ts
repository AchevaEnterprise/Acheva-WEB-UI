import { Component, signal } from '@angular/core';
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
import { CreateAccountBannerComponent } from './auth-banner/create-account-banner.component';
@Component({
  selector: 'app-create-account',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatRippleModule,
    MatIconModule,
    SvgComponent,
    CreateAccountBannerComponent,
  ],
  templateUrl: './create-account.component.html',
  styleUrl: './create-account.component.scss',
})
export class CreateAccountComponent {
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
