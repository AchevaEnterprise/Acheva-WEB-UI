import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SkeletonComponent } from './skeleton.component';

/**
 * A table-shaped loading placeholder: a header strip plus `rows` × `cols`
 * shimmer cells. Drop it in wherever a data table is being fetched.
 *
 * @example <app-skeleton-table [rows]="6" [cols]="5" />
 */
@Component({
  selector: 'app-skeleton-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  template: `
    <div class="sk-table" aria-hidden="true">
      <div class="sk-table__head">
        @for (col of cols_(); track col) {
          <app-skeleton width="60%" height="0.75rem" />
        }
      </div>
      @for (row of rows_(); track row) {
        <div class="sk-table__row">
          @for (col of cols_(); track col) {
            <app-skeleton width="80%" height="1rem" />
          }
        </div>
      }
    </div>
  `,
  styles: `
    .sk-table {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .sk-table__head,
    .sk-table__row {
      display: grid;
      grid-template-columns: repeat(var(--sk-cols, 5), 1fr);
      gap: 1rem;
      align-items: center;
    }

    .sk-table__head {
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #eef1f5;
    }

    .sk-table__row {
      padding: 0.35rem 0;
    }
  `,
  host: {
    '[style.--sk-cols]': 'cols()',
    '[style.display]': "'block'",
  },
})
export class SkeletonTableComponent {
  readonly rows = input<number>(6);
  readonly cols = input<number>(5);

  protected readonly rows_ = computed(() =>
    Array.from({ length: this.rows() }, (_, i) => i)
  );
  protected readonly cols_ = computed(() =>
    Array.from({ length: this.cols() }, (_, i) => i)
  );
}
