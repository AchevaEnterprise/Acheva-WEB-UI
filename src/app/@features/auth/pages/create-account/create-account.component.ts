import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
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
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { finalize, Subscription } from 'rxjs';
import {
  IDepartment,
  IFaculty,
  ISchool,
} from '../../../../@core/models/school.model';
import { AppState } from '../../../../@core/store/app.state';
import {
  loadDepartments,
  loadFaculties,
  loadSchools,
} from '../../../../@core/store/school/school.action';
import {
  departmentsSelector,
  facultiesSelector,
  schoolsSelector,
} from '../../../../@core/store/school/school.selector';
import { ToastService } from '../../../../@core/utility/toast.service';
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
export class CreateAccountComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly store = inject(Store<AppState>);

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
  schoolsOptions = signal<ISchool[]>([]);
  facultiesOptions = signal<IFaculty[]>([]);
  departmentsOptions = signal<IDepartment[]>([]);

  private readonly sub: Subscription = new Subscription();

  form: FormGroup = new FormGroup({
    fullname: new FormControl(),
    email: new FormControl(null, [Validators.required, Validators.email]),
    school: new FormControl(null, Validators.required),
    faculty: new FormControl(null),
    department: new FormControl(null),
    title: new FormControl(null),
    role: new FormControl(null, Validators.required),
    password: new FormControl(null, Validators.required),
    confirm_password: new FormControl(null, Validators.required),
  });

  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);

  RoleEnum = RoleEnum;

  ngOnInit(): void {
    this.verifyRole();
    this.getSchools();
  }

  togglePasswordVisibility() {
    this.showPassword.update((val) => !val);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update((val) => !val);
  }

  verifyRole() {
    this.form.controls['role'].valueChanges.subscribe({
      next: (role: RoleEnum) => {
        if (role === RoleEnum.LECTURER) {
          this.form.controls['fullname'].setValidators([
            Validators.required,
            Validators.pattern(/[a-zA-Z-?]+\s[a-zA-Z-?]+$/),
          ]);
          this.form.controls['title'].setValidators(Validators.required);
          this.form.controls['faculty'].setValidators(Validators.required);
          this.form.controls['department'].setValidators(Validators.required);
        } else if (role === RoleEnum.HOD) {
          this.form.controls['faculty'].setValidators(Validators.required);
          this.form.controls['department'].setValidators(Validators.required);
        } else if (role === RoleEnum.DEAN) {
          this.form.controls['faculty'].setValidators(Validators.required);
        } else {
          if (
            this.form.controls['fullname'].hasValidator(Validators.required)
          ) {
            this.form.controls['fullname'].removeValidators([
              Validators.required,
              Validators.pattern(/[a-zA-Z]+\s[a-zA-Z]+$/),
            ]);
          } else if (
            this.form.controls['title'].hasValidator(Validators.required)
          ) {
            this.form.controls['title'].removeValidators(Validators.required);
          } else if (
            this.form.controls['faculty'].hasValidator(Validators.required)
          ) {
            this.form.controls['faculty'].removeValidators(Validators.required);
          } else if (
            this.form.controls['department'].hasValidator(Validators.required)
          ) {
            this.form.controls['department'].removeValidators(
              Validators.required
            );
          }
        }

        this.form.controls['fullname'].updateValueAndValidity();
        this.form.controls['title'].updateValueAndValidity();
        this.form.controls['faculty'].updateValueAndValidity();
        this.form.controls['department'].updateValueAndValidity();
      },
    });
  }

  getSchools() {
    this.store.dispatch(loadSchools());

    this.sub.add(
      this.store.select(schoolsSelector).subscribe({
        next: (schools) => {
          this.schoolsOptions.set(schools);
        },
      })
    );
  }

  getFaculties(event: MatSelectChange) {
    const schoolId = event.value as string;
    this.store.dispatch(loadFaculties({ schoolId }));

    this.sub.add(
      this.store.select(facultiesSelector).subscribe({
        next: (faculties) => {
          this.facultiesOptions.set(faculties);
        },
      })
    );
  }

  getDepartments(event: MatSelectChange) {
    const facultyId = event.value as string;
    this.store.dispatch(loadDepartments({ facultyId }));

    this.sub.add(
      this.store.select(departmentsSelector).subscribe({
        next: (departments) => {
          this.departmentsOptions.set(departments);
        },
      })
    );
  }

  submitForm() {
    const {
      fullname,
      email,
      school,
      faculty,
      department,
      title,
      role,
      password,
      confirm_password,
    } = this.form.value as {
      fullname: string;
      email: string;
      school: string;
      faculty: string;
      department: string;
      title: string;
      role: RoleEnum;
      password: string;
      confirm_password: string;
    };

    if (password !== confirm_password) {
      this.toast.showNotification(
        'warning',
        'Password Mismatch',
        'Passwords do not match',
        5
      );

      return;
    }

    const [firstname, lastname] = fullname ? fullname.split(' ') : [null, null];

    this.isLoading.set(true);
    const payload = {
      firstname,
      lastname,
      email,
      password,
      confirmPassword: confirm_password,
      faculty: faculty,
      department: department,
      title,
      role,
      school: school,
    } satisfies ISignUp;

    this.sub.add(
      this.authService
        .signUp(payload)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (res) => {
            if (res.status) {
              this.toast.showNotification(
                'success',
                'Account Created',
                'Your account was created successfully'
              );
              this.router.navigate(['/auth/confirm-email'], {
                queryParams: { accountId: res.data._id as string },
              });
            }
          },
          error: (err) => {
            this.toast.showNotification(
              'error',
              'Account Creation Failed',
              err?.error?.message || 'Something went wrong'
            );
          },
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
