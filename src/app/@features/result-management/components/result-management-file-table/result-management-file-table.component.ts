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
import { MatCheckboxModule } from '@angular/material/checkbox';
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
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { PaginatorComponent } from '../../../../@shared/components/paginator/paginator.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IResult } from '../../models/results.model';

@Component({
  selector: 'app-result-management-file-table',
  imports: [
    SvgComponent,
    DatePipe,
    MatTableModule,
    PaginatorComponent,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
    MatMenuModule,
    EmptyStateComponent,
    LoaderComponent,
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

  userRole = this.authService.activeAccount()?.role as RoleEnum;

  loading = input<boolean>(false);
  expand = input<boolean>(false);
  results = input<IResult[]>([]);
  pagination = input<IPaginator>();

  viewResultEvent = output<IResult>();
  trackResultEvent = output<IResult>();
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

  expandedDisplayedColumns: string[] = [
    'courseCode',
    'courseTitle',
    'semester',
    'department',
    'faculty',
    'uploadedBy',
    'createdAt',
    'updatedAt',
    // 'actions',
  ];

  RoleEnum = RoleEnum;

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
        this.displayedColumns.push(
          'uploadedBy',
          'createdAt',
          'updatedAt'
          // 'actions'
        );
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

  viewResult(result: IResult) {
    if (this.userRole === RoleEnum.LECTURER && result.hasBeenSent) return;
    this.viewResultEvent.emit(result);
  }

  trackResult(result: IResult) {
    this.selectedResultId.set(result._id);
    this.trackResultEvent.emit(result);
  }

  paginate(page: PageEvent) {
    this.pageEvent.emit(page);
  }

  makeComment(element: IResult): void {
    // Placeholder for comment functionality
    // This would typically open a comment dialog or navigate to comment section
  }

  ngOnDestroy(): void {
    this.selectedResultId.set(null);
  }
}
