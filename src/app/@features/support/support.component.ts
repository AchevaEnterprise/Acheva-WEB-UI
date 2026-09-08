import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ToastService } from '../../@core/utility/toast.service';
import { ChatThreadComponent } from '../messaging/components/chat-thread/chat-thread.component';
import {
  IConversationSummary,
  IMessage,
  IStreamEvent,
} from '../messaging/models/messaging.model';
import { MessagingService } from '../messaging/services/messaging.service';

/**
 * Support — one thread with the Acheva desk.
 *
 * The same chat as everywhere else in the app, deliberately: nobody should
 * have to learn a second way to write a message because the recipient happens
 * to work for us. What is different is that there is no list and no picker —
 * everyone has exactly one support thread and there is nobody to choose, so
 * the page opens straight into it.
 *
 * The other side is a DESK, not a person. Whoever answers replies as "Acheva
 * Support", so a user is never left waiting on one individual who has gone
 * home.
 */
@Component({
  selector: 'app-support',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatThreadComponent],
  templateUrl: './support.component.html',
  styleUrl: './support.component.scss',
})
export class SupportComponent implements OnInit {
  private readonly messaging = inject(MessagingService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly conversation = signal<IConversationSummary | null>(null);
  readonly messages = signal<IMessage[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  ngOnInit(): void {
    this.openDesk();

    this.messaging.start();
    this.messaging.stream$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onStreamEvent(event));

    this.destroyRef.onDestroy(() => this.messaging.setActiveConversation(null));
  }

  /**
   * Find-or-create, then load the history.
   *
   * Creating on open rather than on first send is what lets a returning user
   * see what they asked last time before they type anything.
   */
  private openDesk(): void {
    this.messaging
      .openSupport()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          const id = String(resp.data?._id ?? '');
          if (!id) {
            this.loading.set(false);
            this.failed.set(true);
            return;
          }
          this.messaging.setActiveConversation(id);
          this.loadThread(id);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  private loadThread(conversationId: string): void {
    this.messaging
      .thread(conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          // The API returns newest first for cursor paging; a reader wants
          // oldest at the top, as every chat does.
          this.messages.set([...resp.data.messages].reverse());
          this.conversation.set(resp.data.conversation);
          this.loading.set(false);
          if (resp.data.conversation.unread > 0) this.markRead(conversationId);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  private markRead(conversationId: string): void {
    this.messaging
      .markRead(conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  /** Optimistic, exactly as the main chat is — see `MessagesComponent`. */
  send(body: string): void {
    const thread = this.conversation();
    if (!thread) return;

    const localId = `pending-${Date.now()}`;
    this.messages.update((rows) => [
      ...rows,
      {
        id: localId,
        body,
        kind: 'TEXT',
        sender: null,
        mine: true,
        createdAt: new Date().toISOString(),
        pending: true,
        read: false,
      },
    ]);

    this.messaging
      .send(thread.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) =>
          this.messages.update((rows) =>
            rows.map((row) => (row.id === localId ? resp.data : row))
          ),
        error: () => {
          this.messages.update((rows) =>
            rows.map((row) =>
              row.id === localId
                ? { ...row, pending: false, failed: true }
                : row
            )
          );
          this.toast.showNotification(
            'error',
            'Not sent',
            'That message did not go through. Check your connection and try again.'
          );
        },
      });
  }

  private onStreamEvent(event: IStreamEvent): void {
    const thread = this.conversation();
    if (!thread || event.payload.conversationId !== thread.id) return;

    if (event.type === 'message:read') {
      const readAt = new Date(event.payload.at ?? Date.now()).getTime();
      this.messages.update((rows) =>
        rows.map((row) =>
          row.mine && !row.read && new Date(row.createdAt).getTime() <= readAt
            ? { ...row, read: true }
            : row
        )
      );
      return;
    }

    if (event.type !== 'message:new') return;

    this.messages.update((rows) => [
      ...rows,
      {
        id: event.payload.messageId ?? `live-${Date.now()}`,
        body: event.payload.body ?? event.payload.preview ?? '',
        kind: 'TEXT',
        sender: event.payload.sender ?? null,
        mine: false,
        createdAt: event.payload.createdAt ?? new Date().toISOString(),
      },
    ]);
    this.markRead(thread.id);
  }
}
