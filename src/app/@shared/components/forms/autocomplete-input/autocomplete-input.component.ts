import {
  Component,
  EventEmitter,
  forwardRef,
  Input,
  Output,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
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
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteInputComponent),
      multi: true,
    },
  ],
})
export class AutocompleteInputComponent implements ControlValueAccessor {
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

  // ControlValueAccessor handlers
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    this.inputValue = typeof value === 'string' ? value : '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Optional: Implement disabled state logic if needed
  }

  ngOnInit(): void {
    this.filteredItems = [];
  }

  onInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value: string = target.value;
    this.inputValue = value;

    this.onChange(value);
    this.textChanged.emit(value);

    if (value.length >= this.minChars) {
      this.filterItems(value);
      this.showSuggestions = true;
    } else {
      this.filteredItems = [];
      this.showSuggestions = false;
    }
  }

  private filterItems(searchTerm: string): void {
    const term = searchTerm.toLowerCase();
    this.filteredItems = this.items.filter((item) => {
      const displayText = this.getDisplayText(item).toLowerCase();
      return displayText.includes(term);
    });
  }

  selectItem(item: unknown): void {
    const displayText = this.getDisplayText(item);
    this.inputValue = displayText;
    this.onChange(displayText);
    this.showSuggestions = false;
    this.itemSelected.emit(item);
  }

  onInputBlur(): void {
    this.onTouched();
    setTimeout(() => {
      this.showSuggestions = false;
    }, 150);
  }

  onInputFocus(): void {
    if (
      this.inputValue.length >= this.minChars &&
      this.filteredItems.length > 0
    ) {
      this.showSuggestions = true;
    }
  }

  clearInput(): void {
    this.inputValue = '';
    this.filteredItems = [];
    this.showSuggestions = false;
    this.onChange('');
    this.textChanged.emit('');
  }

  getDisplayText(item: unknown): string {
    if (!item) return '';
    if (this.displayProperty && typeof item === 'object' && item !== null) {
      const prop = (item as Record<string, unknown>)[this.displayProperty];
      return typeof prop === 'string' ? prop : JSON.stringify(prop ?? '');
    }
    return item.toString();
  }

  trackByFn(index: number, item: unknown): unknown {
    if (!item) return index;
    if (this.displayProperty && typeof item === 'object' && item !== null) {
      return (item as Record<string, unknown>)[this.displayProperty] ?? index;
    }
    return item;
  }
}
