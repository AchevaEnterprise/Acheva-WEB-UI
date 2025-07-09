import { Component, inject, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { NotificationService } from '../../../../@core/utility/notification.service';
import { SvgBackgroudComponent } from '../../component/svg-backgroud/svg-backgroud.component';

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
export class ConfirmEmailComponent implements OnInit {
  private readonly notification = inject(NotificationService);

  readonly codeCtrl: FormControl = new FormControl('', [
    Validators.required,
    Validators.minLength(6),
    Validators.maxLength(6),
  ]);

  ngOnInit(): void {
    this.notification.showNotification(
      'success',
      'Password reset successful',
      "Please wait as you'll be redirected to the create new password page"
    );
  }

  goBack() {
    history.back();
  }
}
