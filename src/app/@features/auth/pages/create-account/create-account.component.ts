import { Component, inject, OnDestroy, signal } from '@angular/core';
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
import { Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { NotificationService } from '../../../../@core/utility/notification.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { AuthBannerComponent } from '../../component/auth-banner/auth-banner.component';
import { PasswordValidityComponent } from '../../component/password-validity/password-validity.component';
import { ISignUp, RoleEnum } from '../../model/auth.model';
import { AuthenticationService } from '../../service/auth.service';

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
export class CreateAccountComponent implements OnDestroy {
  private readonly authService = inject(AuthenticationService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  isLoading = signal(false);
  roleOptions = signal<{ label: string; value: RoleEnum }[]>([
    {
      label: 'Dean',
      value: RoleEnum.DEAN,
    },
    {
      label: 'HOD',
      value: RoleEnum.HOD,
    },
    {
      label: 'Course Advisor',
      value: RoleEnum.COURSE_ADVISOR,
    },
    {
      label: 'Course Coordinator',
      value: RoleEnum.COURSE_COORDINATOR,
    },
    {
      label: 'Lecturer',
      value: RoleEnum.LECTURER,
    },
  ]);

  titleOptions = signal<{ label: string; value: string }[]>([
    {
      label: 'Mr',
      value: 'Mr',
    },
    {
      label: 'Mrs',
      value: 'Mrs',
    },
    {
      label: 'Miss',
      value: 'Miss',
    },
    {
      label: 'Engr.',
      value: 'Engr.',
    },
    {
      label: 'Prof.',
      value: 'Prof.',
    },
  ]);
  private readonly sub: Subscription = new Subscription();

  form: FormGroup = new FormGroup({
    fullname: new FormControl(null, Validators.required),
    email: new FormControl(null, [Validators.required, Validators.email]),
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
    const {
      fullname,
      email,
      faculty,
      department,
      title,
      role,
      password,
      confirm_password,
    } = this.form.value as {
      fullname: string;
      email: string;
      faculty: string;
      department: string;
      title: string;
      role: RoleEnum;
      password: string;
      confirm_password: string;
    };

    if (password !== confirm_password) {
      this.notificationService.showNotification(
        'warning',
        'Password Mismatch',
        'Passwords do not match',
        5
      );

      return;
    }

    const [firstname, lastname] = fullname.split(' ');

    this.isLoading.set(true);
    const payload = {
      firstname,
      lastname,
      email,
      password,
      confirmPassword: confirm_password,
      faculty,
      department,
      title,
      role,
    } satisfies ISignUp;

    this.sub.add(
      this.authService
        .signUp(payload)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (res) => {
            if (res.status) this.router.navigate(['/auth']);
            this.notificationService.showNotification(
              'success',
              'Account Created',
              'Your account was created successfully'
            );
          },
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
