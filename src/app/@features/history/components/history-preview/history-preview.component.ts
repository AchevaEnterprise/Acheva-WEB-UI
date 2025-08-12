import { Component, inject } from '@angular/core';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ImageFallbackDirective } from '../../../../@core/directives/image-fallback.directive';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-history-preview',
  imports: [SvgComponent, ImageFallbackDirective],
  templateUrl: './history-preview.component.html',
  styleUrl: './history-preview.component.scss',
})
export class HistoryPreviewComponent {
  private readonly dialogRef = inject(MatDialogRef<HistoryPreviewComponent>);

  close() {
    this.dialogRef.close();
  }
}
