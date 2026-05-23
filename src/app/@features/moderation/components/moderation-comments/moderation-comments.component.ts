import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  EnvironmentInjector,
  inject,
  input,
  output,
  runInInjectionContext,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { of } from 'rxjs';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { IModerationComment } from '../../models/moderation.model';
import { ModerationService } from '../../services/moderation.service';

/**
 * Read-and-write comments thread tied to a moderation id.
 *
 * Mirrors the pattern of the existing `app-comment` component used on results,
 * but talks to `ModerationService.getComments` / `postComment` and uses the
 * standalone signature shape returned by that endpoint (lecturer is populated
 * with name, accessLevel, dept and faculty).
 */
@Component({
  selector: 'app-moderation-comments',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    ButtonComponent,
    LoaderComponent,
    EmptyStateComponent,
    DatePipe,
  ],
  templateUrl: './moderation-comments.component.html',
  styleUrl: './moderation-comments.component.scss',
})
export class ModerationCommentsComponent {
  private readonly moderationService = inject(ModerationService);
  private readonly authService = inject(AuthenticationService);
  private readonly injector = inject(EnvironmentInjector);

  moderationId = input.required<string>();
  /** Toggle to force a refresh after a parent action (approve, reject, etc.). */
  refresh = input<boolean>(false);

  posted = output<void>();

  commentCtrl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  posting = signal<boolean>(false);

  scrollContainer = viewChild<ElementRef<HTMLDivElement>>('thread');

  comments = rxResource({
    request: () => this.moderationId(),
    loader: ({ request }) =>
      request ? this.moderationService.getComments(request) : of(undefined),
  });

  myId = this.authService.activeAccount()?.id;

  isMine = computed(() => (lecturerId: string) => lecturerId === this.myId);

  constructor() {
    effect(() => {
      if (!this.refresh()) return;
      this.comments.reload();
      this.scheduleScrollToBottom();
    });
  }

  send(): void {
    if (this.commentCtrl.invalid) return;
    const value = this.commentCtrl.value.trim();
    if (!value) return;

    this.posting.set(true);
    this.moderationService.postComment(this.moderationId(), value).subscribe({
      next: (resp) => {
        this.posting.set(false);
        if (resp.status) {
          this.commentCtrl.reset('');
          this.comments.reload();
          this.posted.emit();
          this.scheduleScrollToBottom();
        }
      },
      error: () => this.posting.set(false),
    });
  }

  authorName(comment: IModerationComment): string {
    if (typeof comment.lecturer === 'string') return 'Lecturer';
    const { firstname, lastname } = comment.lecturer;
    return `${firstname ?? ''} ${lastname ?? ''}`.trim() || 'Lecturer';
  }

  authorRole(comment: IModerationComment): string {
    return comment.role.replace(/_/g, ' ');
  }

  authorId(comment: IModerationComment): string {
    return typeof comment.lecturer === 'string'
      ? comment.lecturer
      : comment.lecturer._id;
  }

  /**
   * `afterNextRender` requires an injection context, which subscribe callbacks
   * don't have — wrap it via the captured environment injector so we can
   * schedule a scroll once the new comments paint.
   */
  private scheduleScrollToBottom(): void {
    runInInjectionContext(this.injector, () => {
      afterNextRender(() => {
        const el = this.scrollContainer()?.nativeElement;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    });
  }
}
