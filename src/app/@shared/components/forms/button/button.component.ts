import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-button',
  imports: [MatProgressSpinnerModule, MatButtonModule, MatFormFieldModule],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  loading = input<boolean>(false);
  disabled = input<boolean>(false);
  label = input<string>('');
  type = input<'clear' | 'outline' | 'fill'>('fill');
  classNames = input<string>('');

  clickEvent = output();

  onBtnclick() {
    this.clickEvent.emit();
  }
}
