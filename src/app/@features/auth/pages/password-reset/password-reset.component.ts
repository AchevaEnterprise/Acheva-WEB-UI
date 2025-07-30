import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { SvgBackgroudComponent } from '../../component/svg-backgroud/svg-backgroud.component';
import { AuthenticationService } from '../../service/auth.service';

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
export class PasswordResetComponent implements OnDestroy {
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);

  isLoading = signal(false);
  private readonly sub: Subscription = new Subscription();

  readonly emailCtrl: FormControl = new FormControl('', [
    Validators.email,
    Validators.required,
  ]);

  goBack() {
    history.back();
  }

  resetPassword() {
    this.isLoading.set(true);
    this.sub.add(
      this.authService
        .forgotPassword(this.emailCtrl.value)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (res) => {
            this.router.navigate(['/auth/verify-email'], {
              queryParams: { email: this.emailCtrl.value as string },
            });
          },
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
