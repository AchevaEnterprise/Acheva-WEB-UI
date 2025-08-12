import { Component, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';

@Component({
  selector: 'app-students',
  imports: [SearchInputComponent, ButtonComponent, MatTableModule],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent {
  displayedColumns: string[] = ['regNo', 'name'];
  dataSource = signal<any[]>([]);

  uploadFile() {}

  addStudent() {}
}
