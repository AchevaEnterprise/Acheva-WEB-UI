import { Component, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { NotificationService } from '../../../../@core/utility/notification.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgBackgroudComponent } from '../../component/svg-backgroud/svg-backgroud.component';
import { AuthenticationService } from '../../service/auth.service';

@Component({
  selector: 'app-verify-email',
  imports: [ButtonComponent, SvgBackgroudComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
})
export class VerifyEmailComponent implements OnDestroy {
  private readonly authService = inject(AuthenticationService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = this.route.snapshot.queryParamMap.get('email');
  isLoading = signal(false);
  private readonly sub: Subscription = new Subscription();

  goBack() {
    history.back();
  }

  resendVerificationEmail() {
    this.isLoading.set(true);
    this.sub.add(
      this.authService
        .resendEmailVerification(this.email!)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (res) => {
            if (res.status) {
              this.notificationService.showNotification(
                'success',
                'Verification Email Sent',
                'An email verification has been sent'
              );
            }
          },
        })
    );
  }

  continue() {
    this.router.navigate(['/auth/confirm-email']);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
