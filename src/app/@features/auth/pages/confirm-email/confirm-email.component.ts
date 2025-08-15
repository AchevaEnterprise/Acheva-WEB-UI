import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { NotificationService } from '../../../../@core/utility/notification.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { SvgBackgroudComponent } from '../../component/svg-backgroud/svg-backgroud.component';
import { AuthenticationService } from '../../service/auth.service';

@Component({
  selector: 'app-confirm-email',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    SvgComponent,
    ButtonComponent,
    ReactiveFormsModule,
    SvgBackgroudComponent,
  ],
  templateUrl: './confirm-email.component.html',
  styleUrl: './confirm-email.component.scss',
})
export class ConfirmEmailComponent implements OnDestroy {
  private readonly authService = inject(AuthenticationService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isLoading = signal(false);
  accountId = signal(this.route.snapshot.queryParamMap.get('accountId'));
  readonly codeCtrl: FormControl = new FormControl('', [
    Validators.required,
    Validators.minLength(6),
    Validators.maxLength(6),
  ]);

  private readonly sub: Subscription = new Subscription();

  goBack() {
    history.back();
  }

  confirmCode() {
    this.isLoading.set(true);
    this.sub.add(
      this.authService
        .confirmCode(this.accountId()!, this.codeCtrl.value)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (res) => {
            if (res.status) {
              this.notificationService.showNotification(
                'success',
                'Confirmation Code Verified',
                'Your account was verified successfully, you can now login'
              );
              this.router.navigate(['/auth/login']);
            } else {
              this.notificationService.showNotification(
                'error',
                'Code Verification Failed',
                res.message
              );
            }
          },
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
