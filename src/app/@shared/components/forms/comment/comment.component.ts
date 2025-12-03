import { Component, input, output, signal } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { IResult } from '../../../../@features/result-management/models/results.model';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-comment',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    ButtonComponent,
  ],
  templateUrl: './comment.component.html',
  styleUrl: './comment.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: CommentComponent,
      multi: true,
    },
  ],
})
export class CommentComponent implements ControlValueAccessor {
  result = input<IResult | null>();
  showSubmitBtn = input<boolean>(false);
  submitEvent = output<string>();

  value = signal<string>('');
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  disabled = false;

  writeValue(obj: any): void {
    this.value.set(obj ?? '');
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value.set(input.value);
    this.onChange(input.value);
  }

  onBlur(): void {
    this.onTouched();
  }

  submit() {
    this.submitEvent.emit(this.value());
  }
}
