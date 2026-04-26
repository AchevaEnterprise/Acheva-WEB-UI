import {
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
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
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IGroupedResult } from '../../models/results.model';
import { HasRejectedPipe } from '../../../../@core/pipes/has-rejected.pipe';

@Component({
  selector: 'app-result-management-folder-table',
  standalone: true,
  imports: [
    SvgComponent,
    MatTableModule,
    PaginatorComponent,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
    MatMenuModule,
    MatDividerModule,
    MatIconModule,
    EmptyStateComponent,
    LoaderComponent,
    HasRejectedPipe,
  ],
  templateUrl: './result-management-folder-table.component.html',
  styleUrl: './result-management-folder-table.component.scss',
})
export class ResultManagementFolderTableComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly store = inject(Store<AppState>);
  private readonly destroyRef = inject(DestroyRef);

  loading = input<boolean>(false);
  expand = input<boolean>(false);
  groupedResults = input<IGroupedResult[]>([]);
  pagination = input<IPaginator>();

  viewFolderEvent = output<IGroupedResult>();
  pageEvent = output<PageEvent>();

  faculties = signal<IFaculty[]>([]);
  departments = signal<IDepartment[]>([]);

  // selection = new SelectionModel<IGroupedResult>(true, []);

  displayedColumns: string[] = [
    // 'select',
    'courseCode',
    'courseTitle',
    // 'faculty',
    'semester',
  ];

  ngOnInit(): void {
    this.loadUserSchool();
  }

  loadUserSchool() {
    const currentUser = this.authService.activeAccount();

    if (currentUser) {
      const schoolId = currentUser.school!._id;
      if (schoolId) this.getFaculties(schoolId);
    }
  }

  getFaculties(schoolId: string): void {
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

  // isAllSelected() {
  //   const numSelected = this.selection.selected.length;
  //   const numRows = this.groupedResults().length;
  //   return numSelected === numRows;
  // }

  // /** Selects all rows if they are not all selected; otherwise clear selection. */
  // toggleAllRows() {
  //   if (this.isAllSelected()) {
  //     this.selection.clear();
  //     return;
  //   }

  //   this.selection.select(...this.groupedResults());
  // }

  // /** The label for the checkbox on the passed row */
  // checkboxLabel(row?: IGroupedResult): string {
  //   if (!row) {
  //     return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
  //   }
  //   return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.session}`;
  // }

  openFolder(result: IGroupedResult) {
    this.viewFolderEvent.emit(result);
  }

  paginate(page: PageEvent) {
    this.pageEvent.emit(page);
  }
}
