import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-custom-toggle',
  templateUrl: './custom-toggle.component.html',
  styleUrls: ['./custom-toggle.component.scss'],
})
export class CustomToggleComponent {
  @Input() checked = false;
  @Input() label = 'Active';

  @Output() checkedChange = new EventEmitter<boolean>();

  toggle() {
    this.checked = !this.checked;
    this.checkedChange.emit(this.checked);
  }
}
