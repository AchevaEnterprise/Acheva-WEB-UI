import { Component, input } from '@angular/core';
import { MatPaginatorModule } from '@angular/material/paginator';
import { IPaginator } from '../../../@core/models/paginator.model';
@Component({
  selector: 'app-paginator',
  imports: [MatPaginatorModule],
  templateUrl: './paginator.component.html',
  styleUrl: './paginator.component.scss',
})
export class PaginatorComponent {
  paginator = input<IPaginator>();
}
