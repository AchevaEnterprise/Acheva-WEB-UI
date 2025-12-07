import { Component } from '@angular/core';
import { ButtonComponent } from '../forms/button/button.component';

@Component({
  selector: 'app-back-button',
  imports: [ButtonComponent],
  templateUrl: './back-button.component.html',
  styleUrl: './back-button.component.scss',
})
export class BackButtonComponent {
  return() {
    history.back();
  }
}
