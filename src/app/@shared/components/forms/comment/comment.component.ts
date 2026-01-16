import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { of } from 'rxjs';
import { AuthenticationService } from '../../../../@features/auth/service/auth.service';
import { ResultsService } from '../../../../@features/result-management/services/results.service';
import { EmptyStateComponent } from '../../empty-state/empty-state.component';
import { LoaderComponent } from '../../loader/loader.component';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-comment',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    ButtonComponent,
    LoaderComponent,
    EmptyStateComponent,
    DatePipe,
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
  private readonly resultService = inject(ResultsService);
  private readonly authService = inject(AuthenticationService);

  resultId = input<string>();
  refresh = input<boolean>();
  disableComment = input<boolean>(false);
  showSubmitBtn = input<boolean>(false);

  submitEvent = output<{ resultId: string; comment: string }>();

  value = signal<string>('');
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  disabled = false;

  userId = this.authService.activeAccount()!.id;

  comments = rxResource({
    request: () => this.resultId(),
    loader: ({ request }) =>
      request ? this.resultService.getResultComments(request) : of(undefined),
  });

  commentContainer = viewChild<ElementRef>('commentTray');

  constructor() {
    effect(() => {
      const refresh = this.refresh();

      if (refresh) {
        this.comments.reload();

        afterNextRender(() => {
          const elRef = this.commentContainer();
          const el = elRef?.nativeElement as HTMLElement | undefined;

          if (!el) return;

          el.scrollTo({
            top: el.scrollHeight,
            behavior: 'smooth',
          });
        });
      }
    });
  }

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

  submit(commentInputRef: HTMLTextAreaElement) {
    this.submitEvent.emit({
      resultId: this.resultId()!,
      comment: this.value(),
    });

    commentInputRef.value = '';
  }
}
