import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, finalize, Subscription } from 'rxjs';
import { NotificationService } from '../../../../@core/utility/notification.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { PasswordValidityComponent } from '../../component/password-validity/password-validity.component';
import { SvgBackgroudComponent } from '../../component/svg-backgroud/svg-backgroud.component';
import { IResetPassword } from '../../model/auth.model';
import { AuthenticationService } from '../../service/auth.service';

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
export class CreateNewPasswordComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthenticationService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  token = this.route.snapshot.queryParamMap.get('token');

  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);
  passwordMatchError = signal<string>('');

  form: FormGroup = new FormGroup({
    password: new FormControl('', Validators.required),
    confirm_password: new FormControl('', Validators.required),
  });

  isLoading = signal(false);
  private readonly sub: Subscription = new Subscription();

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

    this.isLoading.set(true);
    const payload: IResetPassword = {
      token: this.token!,
      password,
      confirmPassword: confirm_password,
    };

    this.sub.add(
      this.authService
        .resetPassword(payload)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (resp) => {
            if (resp.status) {
              this.notificationService.showNotification(
                'success',
                'Password Reset',
                'Your password reset is successful'
              );

              this.router.navigate(['/auth/login']);
            }
          },
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
