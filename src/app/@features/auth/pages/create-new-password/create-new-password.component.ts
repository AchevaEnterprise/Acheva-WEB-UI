import { Component, OnInit, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { debounceTime } from 'rxjs';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { SvgBackgroudComponent } from '../../component/svg-backgroud/svg-backgroud.component';
import { PasswordValidityComponent } from '../../component/password-validity/password-validity.component';

@Component({
  selector: 'app-create-new-password',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    SvgComponent,
    ButtonComponent,
    ReactiveFormsModule,
    MatIconModule,
    SvgBackgroudComponent,
    PasswordValidityComponent,
  ],
  templateUrl: './create-new-password.component.html',
  styleUrl: './create-new-password.component.scss',
})
export class CreateNewPasswordComponent implements OnInit {
  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);
  passwordMatchError = signal<string>('');

  form: FormGroup = new FormGroup({
    password: new FormControl('', Validators.required),
    confirm_password: new FormControl('', Validators.required),
  });

  ngOnInit(): void {
    this.passwordMatchListener();
  }

  passwordMatchListener() {
    this.form.controls['confirm_password'].valueChanges
      .pipe(debounceTime(800))
      .subscribe({
        next: (confirmedPassword: string) => {
          const { password } = this.form.value as { password: string };
          if (password !== confirmedPassword)
            this.passwordMatchError.set('Password do not match');
          else this.passwordMatchError.set('');
        },
      });
  }

  togglePasswordVisibility() {
    this.showPassword.update((val) => !val);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update((val) => !val);
  }

  submitForm() {
    const { password, confirm_password } = this.form.value as {
      password: string;
      confirm_password: string;
    };

    if (password !== confirm_password) {
      this.passwordMatchError.set('Password do not match');
      return;
    }

    console.warn(this.form.value);
  }
}
