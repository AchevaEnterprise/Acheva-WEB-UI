import { SelectionModel } from '@angular/cdk/collections';
import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MatCheckboxChange,
  MatCheckboxModule,
} from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { PageEvent } from '@angular/material/paginator';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Store } from '@ngrx/store';
import { IPaginator } from '../../../../@core/models/paginator.model';
import { IDepartment, IFaculty } from '../../../../@core/models/school.model';
import { AppState } from '../../../../@core/store/app.state';
import {
  loadDepartments,
  loadFaculties,
} from '../../../../@core/store/school/school.action';
import {
  departmentsSelector,
  facultiesSelector,
} from '../../../../@core/store/school/school.selector';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IResult } from '../../models/results.model';

export interface FileTableFilter {
  faculty: string;
  department: string;
}

@Component({
  selector: 'app-result-management-file-table',
  imports: [
    DatePipe,
    MatTableModule,
    PaginatorComponent,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
    MatMenuModule,
    EmptyStateComponent,
    LoaderComponent,
    ButtonComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './result-management-file-table.component.html',
  styleUrl: './result-management-file-table.component.scss',
})
export class ResultManagementFileTableComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthenticationService);
  private readonly store = inject(Store<AppState>);
  // private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  faculties = signal<IFaculty[]>([]);
  departments = signal<IDepartment[]>([]);
  selectedResultId = signal<string | null>(null);
  activeRow = signal<IResult | null>(null);

  userRole = this.authService.activeAccount()?.role as RoleEnum;

  loading = input<boolean>(false);
  expand = input<boolean>(false);
  results = input<IResult[]>([]);
  pagination = input<IPaginator>();

  viewResultEvent = output<IResult>();
  trackResultEvent = output<IResult | null>();
  deleteResultEvent = output<IResult>();
  filterEvent = output<FileTableFilter>();
  pageEvent = output<PageEvent>();

  displayedColumns: string[] = [
    'select',
    'courseCode',
    'courseTitle',
    'semester',
    'department',
    'faculty',
  ];
  dataSource = signal<IResult[]>([]);
  selection = new SelectionModel<IResult>(true, []);

  RoleEnum = RoleEnum;

  filterForm = new FormGroup({
    faculty: new FormControl<IFaculty | null>(null, Validators.required),
    department: new FormControl<IDepartment | null>(null, Validators.required),
  });

  constructor() {
    effect(() => {
      // Reset displayed columns to base columns
      this.displayedColumns = [
        'select',
        'courseCode',
        'courseTitle',
        'semester',
        'department',
        'faculty',
      ];

      if (this.expand()) {
        this.displayedColumns.push('uploadedBy', 'createdAt', 'updatedAt');

        if (this.userRole === RoleEnum.LECTURER)
          this.displayedColumns.push('actions');
      }

      if (this.results()) this.dataSource.set(this.results());
    });
  }

  ngOnInit(): void {
    this.loadUserSchool();
  }

  loadUserSchool() {
    const currentUser = this.authService.activeAccount();
    if (currentUser) {
      const schoolId = currentUser.school!._id;
      this.getFaculties(schoolId);
    }
  }

  getFaculties(schoolId: string): void {
    if (!schoolId) return;

    this.store.dispatch(loadFaculties({ schoolId }));
    this.store
      .select(facultiesSelector)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (faculties) => {
          this.faculties.set(faculties);
        },
      });
  }

  getDepartments(event: MatSelectChange | string): void {
    const facultyId =
      typeof event === 'string' ? event : (event.value as IFaculty)._id;

    this.store.dispatch(loadDepartments({ facultyId }));
    this.store
      .select(departmentsSelector)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (departments) => this.departments.set(departments),
      });
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource().length;
    return numSelected === numRows;
  }

  //** Check if a result row is disabled */
  isRowDisabled(result: IResult): boolean {
    return this.userRole === RoleEnum.LECTURER && result.hasBeenSent;
  }

  /** Whether the number of selected enabled elements matches the total number of enabled rows. */
  isAllEnabledSelected() {
    const enabledResults = this.dataSource().filter(
      (r) => !this.isRowDisabled(r)
    );
    const numSelected = this.selection.selected.filter(
      (r) => !this.isRowDisabled(r)
    ).length;
    return numSelected === enabledResults.length && enabledResults.length > 0;
  }

  /** Selects all enabled rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    if (this.isAllEnabledSelected()) {
      this.selection.clear();
      return;
    }

    const enabledResults = this.dataSource().filter(
      (r) => !this.isRowDisabled(r)
    );
    this.selection.select(...enabledResults);
  }

  /** The label for the checkbox on the passed row */
  checkboxLabel(row?: IResult): string {
    if (!row) {
      return `${this.isAllEnabledSelected() ? 'deselect' : 'select'} all`;
    }

    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row._id}`;
  }

  onCheckboxChange(event: MatCheckboxChange, result: IResult) {
    const checked = event.checked;

    if (checked) {
      this.selection.select(result);
      this.activeRow.set(result);
    } else {
      this.selection.deselect(result);
      this.activeRow.set(null);
    }

    if (this.selection.isSelected(result)) {
      this.selectedResultId.set(result._id);
      this.trackResultEvent.emit(result);
    } else {
      if (this.selectedResultId() === result._id) {
        this.selectedResultId.set(null);
      }
      this.trackResultEvent.emit(null);
    }
  }

  viewResult(result: IResult) {
    if (this.userRole === RoleEnum.LECTURER && result.hasBeenSent) return;
    this.viewResultEvent.emit(result);
  }

  trackResult(result: IResult) {
    if (this.activeRow() === result) {
      this.selection.deselect(result);
      this.activeRow.set(null);
      this.trackResultEvent.emit(null);
    } else {
      this.selection.select(result);
      this.activeRow.set(result);
      this.trackResultEvent.emit(result);
    }
  }

  paginate(page: PageEvent) {
    this.pageEvent.emit(page);
  }

  deleteResult(result: IResult) {
    this.deleteResultEvent.emit(result);
  }

  filter() {
    const { faculty, department } = this.filterForm.value;
    this.filterEvent.emit({
      faculty: faculty!._id,
      department: department!._id,
    });
  }

  clearFilter() {
    this.filterForm.reset();
  }

  isApprovedForMe(rejectedBy: string[]) {
    const userId = this.authService.activeAccount()?.id;
    return rejectedBy.includes(userId!);
  }

  ngOnDestroy(): void {
    this.selectedResultId.set(null);
  }
}
