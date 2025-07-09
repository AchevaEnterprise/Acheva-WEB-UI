import { Component, input, output, signal } from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';

@Component({
  selector: 'app-search-select',
  imports: [MatSelectModule, NgxMatSelectSearchModule, ReactiveFormsModule],
  templateUrl: './search-select.component.html',
  styleUrl: './search-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: SearchSelectComponent,
      multi: true,
    },
  ],
})
export class SearchSelectComponent implements ControlValueAccessor {
  loading = input<boolean>(false);
  disabled = input(false);
  placeholder = input<string>('Search...');
  options = input<{ label: string; value: any }[]>([]);

  searchEvent = output<string>();

  value = signal<string>('');
  searchCtrl: FormControl = new FormControl('');

  constructor() {
    this.searchListener();
  }

  searchListener() {
    this.searchCtrl.valueChanges
      .pipe(
        filter((val) => !!val),
        debounceTime(800),
        distinctUntilChanged()
      )
      .subscribe({
        next: (val: string) => this.searchEvent.emit(val),
      });
  }

  writeValue(obj: any): void {
    this.value.set(obj);
  }

  onChange = (value: any) => this.value.set(value);
  onTouch = (value: any) => this.value.set(value);

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouch = fn;
  }

  onSelected(event: MatSelectChange) {
    this.onChange(event.value);
  }
}
