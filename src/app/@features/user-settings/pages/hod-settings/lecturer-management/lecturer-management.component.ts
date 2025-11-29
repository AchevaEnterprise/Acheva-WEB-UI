import { DatePipe } from '@angular/common';
import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  OnDestroy,
  ChangeDetectorRef,
  effect,
  untracked,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageEvent } from '@angular/material/paginator';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize, Subject, takeUntil } from 'rxjs';

import { AssignCourseAdvisorComponent } from '../../../../../@shared/components/assign-course-advisor/assign-course-advisor.component';
import { EmptyStateComponent } from '../../../../../@shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../../@shared/components/forms/search-input/search-input.component';
import { LoaderComponent } from '../../../../../@shared/components/loader/loader.component';
import { PaginatorComponent } from '../../../../../@shared/components/paginator/paginator.component';
import { StatusBadgeComponent } from '../../../../../@shared/components/status-badge/status-badge.component';
import { SvgComponent } from '../../../../../@shared/components/svg/svg.component';
import { UnassignCourseAdvisorComponent } from '../../../../../@shared/components/unassign-course-advisor/unassign-course-advisor.component';
import { AuthenticationService } from '../../../../auth/service/auth.service';
import { LecturerAssignment } from '../../../models/lecturer.model';
import { LecturersService } from '../../../service/lecturer.service';
import { IPaginator } from '../../../../../@core/models/paginator.model';

@Component({
  selector: 'app-lecturer-management',
  imports: [
    MatTableModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    DatePipe,
    ButtonComponent,
    MatSlideToggleModule,
    StatusBadgeComponent,
    PaginatorComponent,
    SearchInputComponent,
    SvgComponent,
    LoaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './lecturer-management.component.html',
  styleUrl: './lecturer-management.component.scss',
})
export class LecturerManagementComponent implements OnInit, OnDestroy {
  private readonly lecturerService = inject(LecturersService);
  private readonly authService = inject(AuthenticationService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  userDepartmentId = this.authService.activeAccount()?.department!._id;

  // Form and table management
  form: FormGroup;
  private formArrayVersion = signal(0);

  // Pagination and selection
  currentPage = signal(0);
  pageSize = signal(10);
  totalLecturers = signal(0);
  selectedIndices = signal<Set<number>>(new Set<number>());

  readonly pageSizeOptions = [5, 10, 25, 50];

  displayedColumns: string[] = [
    'name',
    'email',
    'level',
    'lastDateModified',
    'action',
    'assign',
    'status',
  ];

  // Data and loading states
  lecturersData = signal<LecturerAssignment[]>([]);
  loading = signal<boolean>(false);
  searchQuery = signal<string>('');
  filterValue = signal<string>('');

  // Available levels for assignment
  levelOptions = [
    { label: '100 Level', value: '100' },
    { label: '200 Level', value: '200' },
    { label: '300 Level', value: '300' },
    { label: '400 Level', value: '400' },
  ];

  constructor() {
    this.form = this.fb.group({
      lecturers: this.fb.array([]),
    });

    // Update form when lecturers data changes
    effect(() => {
      const lecturers = this.lecturersData();

      untracked(() => {
        if (lecturers && lecturers.length >= 0) {
          this.totalLecturers.set(lecturers.length);
          this.updateFormWithLecturers(lecturers);
          this.currentPage.set(0);
          this.selectedIndices.set(new Set<number>());
        }
      });
    });
  }

  ngOnInit(): void {
    this.getLecturers();

    // Listen for form changes to emit updates
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.saveLecturerUpdates();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Computed properties
  paginationData = computed<IPaginator>(() => ({
    page: this.currentPage(),
    pageSize: this.pageSize(),
    total: this.totalLecturers(),
  }));

  filteredLecturers = computed(() => {
    this.formArrayVersion();

    let lecturers = this.lecturersArray.controls.map(
      (control) => control.value as LecturerAssignment
    );

    // Apply search filter
    const query = this.searchQuery().toLowerCase();
    if (query) {
      lecturers = lecturers.filter(
        (lecturer) =>
          lecturer.firstname?.toLowerCase().includes(query) ||
          lecturer.lastname?.toLowerCase().includes(query) ||
          lecturer.email?.toLowerCase().includes(query)
      );
    }

    // Apply level filter
    // const filter = this.filterValue();
    // if (filter) {
    //   if (filter === 'assigned') {
    //     lecturers = lecturers.filter(lecturer => lecturer.level && lecturer.level !== 'N/A');
    //   } else if (filter === 'unassigned') {
    //     lecturers = lecturers.filter(lecturer => !lecturer.level || lecturer.level === 'N/A');
    //   } else {
    //     lecturers = lecturers.filter(lecturer => lecturer.level === filter);
    //   }
    // }

    return lecturers;
    // return [];
  });

  paginatedLecturers = computed(() => {
    const filtered = this.filteredLecturers();
    const startIndex = this.currentPage() * this.pageSize();
    const endIndex = startIndex + this.pageSize();
    return filtered.slice(startIndex, endIndex);
  });

  paginatedControls = computed(() => {
    this.formArrayVersion(); // Make reactive
    const startIndex = this.currentPage() * this.pageSize();
    const endIndex = startIndex + this.pageSize();
    return this.lecturersArray.controls.slice(startIndex, endIndex);
  });

  get lecturersArray(): FormArray {
    return this.form.get('lecturers') as FormArray;
  }

  // Form management methods
  private updateFormWithLecturers(lecturers: LecturerAssignment[]): void {
    // Clear existing form array
    while (this.lecturersArray.length !== 0) {
      this.lecturersArray.removeAt(0);
    }

    // Add lecturer form groups
    lecturers.forEach((lecturer) => {
      this.lecturersArray.push(this.createLecturerFormGroup(lecturer));
    });

    this.formArrayVersion.update((v) => v + 1);
    this.cdr.detectChanges();
  }

  private createLecturerFormGroup(lecturer: LecturerAssignment): FormGroup {
    const group = this.fb.group({
      _id: [lecturer._id],
      firstname: [lecturer.firstname || '', Validators.required],
      lastname: [lecturer.lastname || '', Validators.required],
      email: [lecturer.email || '', [Validators.required, Validators.email]],
      assignedLevel: [lecturer.assignedLevel || 'NONE'],
      lastDateModified: [],
      isActive: [false],
      isAssigned: [this.isAssigned(lecturer)],
    });

    return group;
  }

  getFormErrors(): string[] {
    const errors: string[] = [];

    this.lecturersArray.controls.forEach((control) => {
      const lecturer: LecturerAssignment = control.value as LecturerAssignment;
      const lecturerName = `${lecturer.firstname} ${lecturer.lastname}`;

      if (control.get('firstname')?.errors?.['required']) {
        errors.push(`${lecturerName}: First name is required`);
      }
      if (control.get('lastname')?.errors?.['required']) {
        errors.push(`${lecturerName}: Last name is required`);
      }
      if (control.get('email')?.errors?.['required']) {
        errors.push(`${lecturerName}: Email is required`);
      }
      if (control.get('email')?.errors?.['email']) {
        errors.push(`${lecturerName}: Invalid email format`);
      }
    });

    return errors;
  }

  // Data fetching
  getLecturers(): void {
    this.loading.set(true);
    this.lecturerService
      .getLecturersInDepartment(this.userDepartmentId!)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.lecturersData.set(resp.data);
          }
        },
      });
  }

  // Save updates
  private saveLecturerUpdates(): void {
    if (this.form.valid) {
      // const formData = this.form.value.lecturers as LecturerAssignment[];
      // Here you would typically send the updates to your backend
    }
  }

  // Helper methods for template
  getFormControl(index: number, controlName: string): FormControl {
    const controls = this.paginatedControls();
    if (index < 0 || index >= controls.length) {
      return new FormControl('');
    }
    return controls[index]?.get(controlName) as FormControl;
  }

  getControlValue(index: number, controlName: string): any {
    const controls = this.paginatedControls();
    if (index < 0 || index >= controls.length) {
      return '';
    }
    return controls[index]?.get(controlName)?.value ?? '';
  }

  hasControlError(
    index: number,
    controlName: string,
    errorType: string
  ): boolean {
    const controls = this.paginatedControls();
    if (index < 0 || index >= controls.length) {
      return false;
    }
    return controls[index]?.get(controlName)?.errors?.[errorType] ?? false;
  }

  updateLecturerLevel(index: number, level: string): void {
    const actualIndex = this.currentPage() * this.pageSize() + index;
    const control = this.lecturersArray.at(actualIndex);
    if (control) {
      control.get('level')?.setValue(level);
      control.get('isAssigned')?.setValue(!!level && level !== 'N/A');
      this.formArrayVersion.update((v) => v + 1);
    }
  }

  // Utility methods
  getInitials(firstName: string, lastName: string): string {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  }

  isAssigned(lecturer: LecturerAssignment): boolean {
    return !!(lecturer.assignedLevel && lecturer.assignedLevel !== 'NONE');
  }

  // Selection methods
  toggleRowSelection(index: number): void {
    const actualIndex = this.currentPage() * this.pageSize() + index;
    const updated = new Set(this.selectedIndices());
    if (updated.has(actualIndex)) {
      updated.delete(actualIndex);
    } else {
      updated.add(actualIndex);
    }
    this.selectedIndices.set(updated);
  }

  toggleSelectAll(checked: boolean): void {
    const startIndex = this.currentPage() * this.pageSize();
    const endIndex = Math.min(
      startIndex + this.pageSize(),
      this.lecturersArray.length
    );
    const updated = new Set(this.selectedIndices());

    for (let i = startIndex; i < endIndex; i++) {
      if (checked) {
        updated.add(i);
      } else {
        updated.delete(i);
      }
    }
    this.selectedIndices.set(updated);
  }

  isRowSelected(index: number): boolean {
    const actualIndex = this.currentPage() * this.pageSize() + index;
    return this.selectedIndices().has(actualIndex);
  }

  isAllSelected(): boolean {
    const startIndex = this.currentPage() * this.pageSize();
    const endIndex = Math.min(
      startIndex + this.pageSize(),
      this.lecturersArray.length
    );

    if (endIndex <= startIndex) return false;

    for (let i = startIndex; i < endIndex; i++) {
      if (!this.selectedIndices().has(i)) return false;
    }
    return true;
  }

  // Pagination
  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  // Search and filter
  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(0); // Reset to first page
  }

  onFilter(value: string): void {
    this.filterValue.set(value);
    this.currentPage.set(0); // Reset to first page
  }

  // Assignment actions
  toggleAssignment(index: number, event: any): void {
    if (event.checked) {
      this.quickAssign(index);
    } else {
      this.quickUnassign(index);
    }
  }

  quickAssign(index: number): void {
    // For quick assignment, you might want to show a level selector
    // For now, we'll just open the assignment dialog
    const actualIndex = this.currentPage() * this.pageSize() + index;
    const lecturerData: LecturerAssignment = this.lecturersArray.at(actualIndex)
      ?.value as LecturerAssignment;
    if (lecturerData) {
      this.confirmAssignAsCourseAdvisor(lecturerData);
    }
  }

  quickUnassign(index: number): void {
    const actualIndex = this.currentPage() * this.pageSize() + index;
    const control = this.lecturersArray.at(actualIndex);
    if (control) {
      control.get('level')?.setValue('');
      control.get('isAssigned')?.setValue(false);
      this.formArrayVersion.update((v) => v + 1);
    }
  }

  confirmAssignAsCourseAdvisor(lecturer: LecturerAssignment): void {
    this.dialog
      .open(AssignCourseAdvisorComponent, {
        width: '40%',
        data: {
          lecturer: `${lecturer.firstname} ${lecturer.lastname}`,
          lecturerId: lecturer._id,
        },
      })
      .afterClosed()
      .subscribe({
        next: (resp) => {
          if (resp) this.getLecturers();
        },
      });
  }

  confirmUnassignAsCourseAdvisor(lecturer: LecturerAssignment): void {
    this.dialog
      .open(UnassignCourseAdvisorComponent, {
        width: '40%',
        data: {
          lecturerId: lecturer._id,
        },
      })
      .afterClosed()
      .subscribe({
        next: (resp) => {
          if (resp) this.getLecturers();
        },
      });
  }

  // Bulk operations
  getSelectedLecturers(): LecturerAssignment[] {
    return Array.from(this.selectedIndices())
      .map((i) => this.lecturersArray.at(i)?.value as LecturerAssignment)
      .filter((v) => !!v);
  }

  bulkAssign(): void {
    const selected = this.getSelectedLecturers();
    if (selected.length > 0) {
      // Implement bulk assignment logic
    }
  }

  bulkUnassign(): void {
    const selected = this.getSelectedLecturers();
    if (selected.length > 0) {
      // Implement bulk unassignment logic
    }
  }

  // Form validation
  validateForm(): boolean {
    return this.form.valid;
  }

  hasFormErrors(): boolean {
    return this.form.invalid && this.form.touched;
  }

  saveAllChanges(): void {
    if (this.validateForm()) {
      this.saveLecturerUpdates();
    }
  }
}
