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
import { Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { AuthBannerComponent } from '../../component/auth-banner/auth-banner.component';
import { AuthenticationService } from '../../service/auth.service';

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
    this.isLoading.set(true);

    this.sub.add(
      this.authService
        .signIn(this.form.value)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (res) => {
            if (res.status) this.router.navigate(['/dashboard']);
          },
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
