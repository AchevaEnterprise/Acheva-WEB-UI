import { Component, input, OnInit, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule, MatPrefix } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { SvgComponent } from '../../svg/svg.component';

@Component({
  selector: 'app-search-input',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    SvgComponent,
    ReactiveFormsModule,
    MatPrefix,
  ],
  templateUrl: './search-input.component.html',
  styleUrl: './search-input.component.scss',
})
export class SearchInputComponent implements OnInit {
  placeholder = input<string>('Search...');
  searchEvent = output<string>();

  searchCtrl: FormControl = new FormControl('');

  ngOnInit(): void {
    this.searchListener();
  }

  searchListener() {
    this.searchCtrl.valueChanges
      .pipe(distinctUntilChanged(), debounceTime(800))
      .subscribe({
        next: (value: string) => this.searchEvent.emit(value),
      });
  }
}
