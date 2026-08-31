import { Component, computed, input, output } from '@angular/core';
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

  /**
   * The real range on screen. The label used to print the page SIZE as the
   * upper bound, so a short last page — or any total below one page — read
   * nonsense like "Showing 1 to 12 of 10".
   */
  range = computed(() => {
    const paginator = this.paginator();
    const total = paginator?.total ?? 0;
    const pageSize = paginator?.pageSize || 1;
    const page = paginator?.page || 1;

    if (total === 0) return { from: 0, to: 0, total: 0 };

    const from = (page - 1) * pageSize + 1;
    return { from, to: Math.min(page * pageSize, total), total };
  });

  onPageChange(event: PageEvent): void {
    this.pageEvent.emit(event);
  }
}
