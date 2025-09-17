import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-autocomplete-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
  ],
  templateUrl: './autocomplete-input.component.html',
  styleUrl: './autocomplete-input.component.scss',
})
export class AutocompleteInputComponent {
  @Input() items: any[] = [];
  @Input() displayProperty: string = '';
  @Input() placeholder: string = 'Type to search...';
  @Input() label: string = '';
  @Input() appearance: 'fill' | 'outline' = 'fill';
  @Input() hint: string = '';
  @Input() minChars: number = 1;
  @Output() itemSelected = new EventEmitter<any>();
  @Output() textChanged = new EventEmitter<string>();

  inputValue: string = '';
  filteredItems: any[] = [];
  showSuggestions: boolean = false;

  ngOnInit() {
    this.filteredItems = [];
  }

  onInputChange(event: any) {
    const value = event.target.value;
    this.inputValue = value;

    // Always emit the text change
    this.textChanged.emit(value);

    if (value.length >= this.minChars) {
      this.filterItems(value);
      this.showSuggestions = true;
    } else {
      this.filteredItems = [];
      this.showSuggestions = false;
    }
  }

  private filterItems(searchTerm: string) {
    const term = searchTerm.toLowerCase();
    this.filteredItems = this.items.filter((item) => {
      const displayText = this.getDisplayText(item).toLowerCase();
      return displayText.includes(term);
    });
  }

  selectItem(item: any) {
    this.inputValue = this.getDisplayText(item);
    this.showSuggestions = false;
    this.itemSelected.emit(item);
  }

  onBlur() {
    // Delay hiding suggestions to allow click events to fire
    setTimeout(() => {
      this.showSuggestions = false;
    }, 150);
  }

  onInputBlur() {
    // Handle blur - emit final text value if needed
    this.onBlur();
    // You could add additional logic here if needed
  }

  onInputFocus() {
    if (
      this.inputValue.length >= this.minChars &&
      this.filteredItems.length > 0
    ) {
      this.showSuggestions = true;
    }
  }

  clearInput() {
    this.inputValue = '';
    this.filteredItems = [];
    this.showSuggestions = false;
    this.textChanged.emit('');
  }

  getDisplayText(item: any): string {
    if (!item) return '';
    return this.displayProperty ? item[this.displayProperty] : item.toString();
  }

  trackByFn(index: number, item: any) {
    return this.displayProperty ? item[this.displayProperty] : item;
  }
}
