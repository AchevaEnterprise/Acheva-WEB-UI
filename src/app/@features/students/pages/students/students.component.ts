import { Component, inject, OnInit, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IStudent } from '../../models/student.model';
import { StudentService } from '../../services/student.service';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-students',
  imports: [
    SearchInputComponent,
    ButtonComponent,
    MatTableModule,
    LoaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly studentService = inject(StudentService);

  displayedColumns: string[] = ['registrationNumber', 'fullName'];
  dataSource = signal<IStudent[]>([]);

  loading = signal(false);

  ngOnInit(): void {
    this.getStudents();
  }

  getStudents() {
    this.loading.set(true);
    const { school, department, assignedLevel } =
      this.authService.activeAccount()!;

    this.studentService
      .getStudents({
        school: school?._id,
        department: department?._id,
        level: assignedLevel,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          const sortedStudents = resp.data.sort((a, b) =>
            (a.fullName ?? '').localeCompare(b.fullName ?? '')
          );

          this.dataSource.set(sortedStudents);
        },
      });
  }

  uploadFile() {}

  addStudent() {}
}
