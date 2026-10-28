import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
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
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { AuthBannerComponent } from '../../component/auth-banner/auth-banner.component';
import { AuthenticationService } from '../../service/auth.service';
import { authErrorText } from '../../utils/auth-error';
import { ToastService } from '../../../../@core/utility/toast.service';

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
export class LoginComponent implements AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  showPassword = signal(false);
  isLoading = signal(false);
  private readonly sub: Subscription = new Subscription();

  @ViewChildren('inputRef') inputRef!: QueryList<ElementRef<HTMLInputElement>>;

  form: FormGroup = new FormGroup({
    email: new FormControl<string>('', [Validators.required, Validators.email]),
    password: new FormControl<string>('', Validators.required),
  });

  ngAfterViewInit(): void {
    this.enterListener();
  }

  enterListener() {
    this.inputRef.forEach((input, index) => {
      input.nativeElement.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();

          if (index < this.inputRef.length - 1) {
            this.inputRef.toArray()[index + 1].nativeElement.focus();
          } else {
            this.submitForm();
          }
        }
      });
    });
  }

  togglePasswordVisibility() {
    this.showPassword.update((show) => !show);
  }

  submitForm() {
    // Enter in the password field reaches here even while the button is
    // disabled — an invalid form or a sign-in already in flight stops here.
    if (this.form.invalid || this.isLoading()) return;
    this.isLoading.set(true);

    this.sub.add(
      this.authService
        .signIn(this.form.value)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (res) => {
            if (res.status) void this.router.navigateByUrl(this.afterSignIn());
          },
          error: (err: unknown) => this.explainFailure(err),
        })
    );
  }

  /**
   * Back to the page the guard turned them away from — only an in-app path,
   * never another origin (`//evil.example` is protocol-relative).
   */
  private afterSignIn(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    return redirect?.startsWith('/') && !redirect.startsWith('//')
      ? redirect
      : '/dashboard';
  }

  private explainFailure(err: unknown): void {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    const raw: unknown =
      err instanceof HttpErrorResponse
        ? (err.error as { message?: unknown } | null)?.message
        : undefined;
    const message = typeof raw === 'string' ? raw : '';

    // Wrong password (400) and unknown email (404) read the same: the page
    // must not tell a stranger which addresses have accounts. A student's
    // credentials land here too, hence the pointer to their own portal.
    if (status === 404 || (status === 400 && /credential/i.test(message))) {
      this.toast.showNotification(
        'error',
        'Incorrect email or password',
        'Check your email and password and try again. Students sign in on the student portal.'
      );
      return;
    }

    if (status === 403 && /not verified/i.test(message)) {
      this.toast.showNotification(
        'warning',
        'Verify your email first',
        'Press "Resend Email" to get a new verification code.'
      );
      void this.router.navigate(['/auth/verify-email'], {
        queryParams: { email: this.form.value.email as string },
      });
      return;
    }

    const text = authErrorText(err);
    this.toast.showNotification('error', text.title, text.message);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
