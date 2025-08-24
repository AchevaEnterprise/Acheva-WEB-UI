import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { ConfirmationComponent } from '../../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../../@shared/components/forms/search-input/search-input.component';
import { PaginatorComponent } from '../../../../../@shared/components/paginator/paginator.component';
import { StatusBadgeComponent } from '../../../../../@shared/components/status-badge/status-badge.component';
import { SvgComponent } from '../../../../../@shared/components/svg/svg.component';
import { AuthenticationService } from '../../../../auth/service/auth.service';
import { ILecturer } from '../../../models/lecturer.model';
import { LecturersService } from '../../../service/lecturer.service';

@Component({
  selector: 'app-lecturer-management',
  imports: [
    MatTableModule,
    DatePipe,
    ButtonComponent,
    MatSlideToggleModule,
    StatusBadgeComponent,
    PaginatorComponent,
    SearchInputComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    SvgComponent,
  ],
  templateUrl: './lecturer-management.component.html',
  styleUrl: './lecturer-management.component.scss',
})
export class LecturerManagementComponent implements OnInit {
  private readonly lecturerService = inject(LecturersService);
  private readonly authService = inject(AuthenticationService);
  private readonly dialog = inject(MatDialog);

  userDepartmentId = this.authService.activeAccount()?.department;

  displayedColumns: string[] = [
    'name',
    'email',
    'level',
    'lastDateModified',
    'action',
    'assign',
    'status',
  ];
  dataSource = signal<ILecturer[]>([]);
  loading = signal<boolean>(false);

  ngOnInit(): void {
    this.getLecturers();
  }

  getLecturers() {
    this.lecturerService
      .getLecturersInDepartment(this.userDepartmentId!)
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.dataSource.set(resp.data.data);
          }
        },
      });
  }

  confirmAssignAsCourseAdvisor(row: ILecturer) {
    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          subTitle: `You're about to assign this lecturer a Course Advisor role.`,
          message: `This action will permit their access to student advisory tools and responsibilities. Do you wish to proceed?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (result: boolean) => {
          if (result) this.assignAsCourseAdvisor(row);
        },
      });
  }

  confirmRevokeRoleAsCourseAdvisor(row: ILecturer) {
    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You're about to revoke this lecturer's Course Advisor role.`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (result: boolean) => {
          if (result) this.revokeRoleAsCourseAdvisor(row);
        },
      });
  }

  assignAsCourseAdvisor(row: ILecturer) {
    this.lecturerService.assignAsCourseAdvisor(row._id).subscribe({
      next: (resp) => {
        if (resp.status) {
          this.getLecturers();
        }
      },
    });
  }

  revokeRoleAsCourseAdvisor(row: ILecturer) {
    this.lecturerService.revokeRoleAsCourseAdvisor(row._id).subscribe({
      next: (resp) => {
        if (resp.status) {
          this.getLecturers();
        }
      },
    });
  }
}
