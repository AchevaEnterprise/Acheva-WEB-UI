import { Component, input, output } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { IPaginator } from '../../../@core/models/paginator.model';

@Component({
  selector: 'app-paginator',
  imports: [MatPaginatorModule],
  templateUrl: './paginator.component.html',
  styleUrl: './paginator.component.scss',
})
export class PaginatorComponent {
  paginator = input<IPaginator>();
  pageEvent = output<PageEvent>();

  // Optional inputs for customization
  pageSizeOptions = input<number[]>([5, 10, 25, 50, 100]);
  hidePageSize = input<boolean>(false);
  showFirstLastButtons = input<boolean>(true);
  disabled = input<boolean>(false);

  onPageChange(event: PageEvent): void {
    this.pageEvent.emit(event);
  }
}
