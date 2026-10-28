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
  /**
   * Departments that already have a Head, faculties that already have a Dean.
   * Those options stay visible but unselectable: a greyed-out row explains why
   * you cannot pick it, whereas hiding it just looks like your department is
   * missing from the list.
   */
  departmentsWithHod = signal<string[]>([]);
  facultiesWithDean = signal<string[]>([]);

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
        const { fullname, title, faculty, department } = this.form.controls;

        // Start from nothing on every change. Validators used to be only
        // ADDED, so picking Lecturer and then HOD left the hidden Full Name
        // and Title required — the button stayed disabled with every
        // visible field filled and nothing on screen saying why.
        [fullname, title, faculty, department].forEach((control) =>
          control.clearValidators()
        );

        if (role === RoleEnum.LECTURER) {
          fullname.setValidators([
            Validators.required,
            Validators.pattern(/[a-zA-Z-?]+\s[a-zA-Z-?]+$/),
          ]);
          title.setValidators(Validators.required);
          faculty.setValidators(Validators.required);
          department.setValidators(Validators.required);
        } else if (role === RoleEnum.HOD) {
          faculty.setValidators(Validators.required);
          department.setValidators(Validators.required);
        } else if (role === RoleEnum.DEAN) {
          faculty.setValidators(Validators.required);
        }

        [fullname, title, faculty, department].forEach((control) =>
          control.updateValueAndValidity()
        );
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
    this.loadOccupiedLeadershipRoles(schoolId);

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

  /** One call per school — the whole form's occupancy in a single request. */
  private loadOccupiedLeadershipRoles(schoolId: string): void {
    this.sub.add(
      this.authService.getOccupiedLeadershipRoles(schoolId).subscribe({
        next: (resp) => {
          this.departmentsWithHod.set(resp.data?.departmentsWithHod ?? []);
          this.facultiesWithDean.set(resp.data?.facultiesWithDean ?? []);
        },
        error: () => {
          // Never block sign-up on this: the backend rejects a duplicate
          // anyway, so the worst case is the old behaviour.
          this.departmentsWithHod.set([]);
          this.facultiesWithDean.set([]);
        },
      })
    );
  }

  /** Only an incoming HOD is blocked by a department that already has one. */
  isDepartmentTaken(departmentId: string): boolean {
    return (
      this.form.controls['role'].value === RoleEnum.HOD &&
      this.departmentsWithHod().includes(departmentId)
    );
  }

  /** Likewise, only an incoming Dean is blocked by a faculty that has one. */
  isFacultyTaken(facultyId: string): boolean {
    return (
      this.form.controls['role'].value === RoleEnum.DEAN &&
      this.facultiesWithDean().includes(facultyId)
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

    // First and last word; anything between is the middle name. A plain
    // split(' ') dropped the third word of a three-part name and turned a
    // double space into an empty surname.
    const names = fullname ? fullname.trim().split(/\s+/) : [];
    const firstname = names[0] ?? null;
    const lastname = names.length > 1 ? names[names.length - 1] : null;
    const middlename =
      names.length > 2 ? names.slice(1, -1).join(' ') : undefined;

    this.isLoading.set(true);
    const payload = {
      firstname,
      middlename,
      lastname,
      email,
      password,
      confirmPassword: confirm_password,
      faculty: faculty,
      department: department,
      // The API takes `titles` (an array); a lone `title` was stripped by
      // its whitelist, so the title picked here was never saved.
      titles: title ? [title] : undefined,
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
                // The email too — "Resend" on that page sends to it, and
                // without it the resend went out as `null` (a 500).
                queryParams: { accountId: res.data._id as string, email },
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
