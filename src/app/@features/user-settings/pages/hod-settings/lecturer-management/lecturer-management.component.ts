import { DatePipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { ButtonComponent } from '../../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../../@shared/components/forms/search-input/search-input.component';
import { PaginatorComponent } from '../../../../../@shared/components/paginator/paginator.component';
import { StatusBadgeComponent } from '../../../../../@shared/components/status-badge/status-badge.component';
import { SvgComponent } from '../../../../../@shared/components/svg/svg.component';

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
export class LecturerManagementComponent {
  displayedColumns: string[] = [
    'name',
    'level',
    'lastDateModified',
    'action',
    'assign',
    'status',
  ];
  dataSource = signal<any[]>([]);
}
