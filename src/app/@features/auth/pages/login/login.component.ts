import { CommonModule } from '@angular/common';
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
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { AuthBannerComponent } from '../../component/auth-banner/auth-banner.component';

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
export class LoginComponent implements OnDestroy {
  // private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);

  showPassword = signal(false);
  isLoading = signal(false);
  private readonly sub: Subscription = new Subscription();

  form: FormGroup = new FormGroup({
    email: new FormControl<string>('', [Validators.required, Validators.email]),
    password: new FormControl<string>('', Validators.required),
  });

  submitForm() {
    this.isLoading.set(true);

    // Uncomment if API is ready
    // this.sub.add(
    //   this.authService
    //     .signIn(this.form.value)
    //     .pipe(finalize(() => this.isLoading.set(false)))
    //     .subscribe({
    //       next: (res) => {
    //         if (res.status) this.router.navigate(['/dashboard']);
    //       },
    //     })
    // );

    this.router.navigate(['/dashboard']);
  }

  togglePasswordVisibility() {
    this.showPassword.update((show) => !show);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
