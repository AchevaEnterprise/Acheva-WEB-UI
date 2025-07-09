import { Component, input } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-card',
  imports: [MatDividerModule, SvgComponent],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  label = input<string>();
  description = input<string>();
  iconSrc = input<string>();
  showDivider = input<boolean>(false);
}
