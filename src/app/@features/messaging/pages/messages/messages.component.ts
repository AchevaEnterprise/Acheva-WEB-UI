import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';

import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SkeletonComponent } from '../../../../@shared/components/skeleton/skeleton.component';
import { ToastService } from '../../../../@core/utility/toast.service';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AnnouncementComposerComponent } from '../../components/announcement-composer/announcement-composer.component';
import { MessageTicksComponent } from '../../components/message-ticks/message-ticks.component';
import { NewConversationComponent } from '../../components/new-conversation/new-conversation.component';
import {
  IConversationSummary,
  IDirectoryPerson,
  IMessage,
  IStreamEvent,
} from '../../models/messaging.model';
import { MessagingService } from '../../services/messaging.service';

/**
 * Messages — the familiar two-pane chat layout: threads on the left, the open
 * conversation on the right.
 *
 * The arrangement is borrowed deliberately. Everyone who will use this has
 * used WhatsApp, so the layout, the bubble alignment and the unread pill need
 * no explanation. The one thing not borrowed is the colour: outgoing bubbles
 * are Acheva blue rather than WhatsApp green, because green is off-palette
 * here and a chat that looked like a different product inside the app would be
 * more disorienting than a chat with unfamiliar colours.
 */
@Component({
  selector: 'app-messages',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    ButtonComponent,
    SkeletonComponent,
    MessageTicksComponent,
  ],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss',
})
export class MessagesComponent implements OnInit {
  private readonly messaging = inject(MessagingService);
  private readonly auth = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly conversations = signal<IConversationSummary[]>([]);
  readonly messages = signal<IMessage[]>([]);
  readonly active = signal<IConversationSummary | null>(null);
  readonly loadingInbox = signal(true);
  readonly loadingThread = signal(false);
  readonly draft = signal('');
  readonly search = signal('');

  /** Only these offices can address a room. Mirrors the server's rule. */
  readonly canAnnounce = computed(() => {
    const role = this.auth.activeAccount()?.role;
    return (
      role === RoleEnum.HOD ||
      role === RoleEnum.DEAN ||
      role === RoleEnum.COURSE_ADVISOR
    );
  });

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.conversations();
    return this.conversations().filter((c) =>
      (c.title ?? '').toLowerCase().includes(term)
    );
  });

  readonly totalUnread = computed(() =>
    this.conversations().reduce((sum, c) => sum + c.unread, 0)
  );

  ngOnInit(): void {
    this.loadInbox();

    // The stream belongs to the service and runs for the whole session, so
    // this page only listens. Connecting here was what made the chat live only
    // while it was on screen — and left the sidebar badge with nothing to
    // count from anywhere else in the app.
    this.messaging.start();
    this.messaging.stream$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onStreamEvent(event));

    // Leaving the page means no thread is being watched any more.
    this.destroyRef.onDestroy(() => this.messaging.setActiveConversation(null));
  }

  private loadInbox(): void {
    this.messaging
      .inbox()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.conversations.set([...resp.data.conversations]);
          this.loadingInbox.set(false);
        },
        error: () => this.loadingInbox.set(false),
      });
  }

  open(conversation: IConversationSummary): void {
    this.active.set(conversation);
    // Tell the service what is on screen, so a message arriving in THIS thread
    // is not also counted on the sidebar badge.
    this.messaging.setActiveConversation(conversation.id);
    this.loadingThread.set(true);
    this.messages.set([]);

    this.messaging
      .thread(conversation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          // The API returns newest first for cursor paging; the reader wants
          // oldest at the top, as every chat does.
          this.messages.set([...resp.data.messages].reverse());
          this.loadingThread.set(false);
          this.scrollToLatest();
        },
        error: () => this.loadingThread.set(false),
      });

    if (conversation.unread > 0) this.clearUnread(conversation.id);
  }

  private clearUnread(conversationId: string): void {
    this.conversations.update((rows) =>
      rows.map((row) =>
        row.id === conversationId ? { ...row, unread: 0 } : row
      )
    );
    this.messaging
      .markRead(conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  /**
   * Send optimistically.
   *
   * The bubble appears the instant Enter is pressed, marked pending, and is
   * replaced by the server's copy when it lands. On a network that stalls for
   * two seconds this is the whole difference between a chat that feels alive
   * and one that feels broken.
   */
  sendDraft(): void {
    const body = this.draft().trim();
    const conversation = this.active();
    if (!body || !conversation) return;

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
    this.draft.set('');
    this.scrollToLatest();

    this.messaging
      .send(conversation.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.messages.update((rows) =>
            rows.map((row) => (row.id === localId ? resp.data : row))
          );
          this.bumpConversation(conversation.id, body);
        },
        error: () => {
          // Kept, marked failed. Dropping it would lose what someone typed.
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

  /** Move a thread to the top of the list, as any chat app does. */
  private bumpConversation(conversationId: string, preview: string): void {
    this.conversations.update((rows) => {
      const found = rows.find((row) => row.id === conversationId);
      if (!found) return rows;
      const updated: IConversationSummary = {
        ...found,
        lastMessage: {
          preview,
          at: new Date().toISOString(),
          sender: null,
          mine: true,
          read: false,
        },
        updatedAt: new Date().toISOString(),
      };
      return [updated, ...rows.filter((row) => row.id !== conversationId)];
    });
  }

  private onStreamEvent(event: IStreamEvent): void {
    if (event.type === 'conversation:new') {
      this.loadInbox();
      return;
    }

    if (event.type === 'message:read') {
      this.applyReadReceipt(event);
      return;
    }

    if (event.type !== 'message:new') return;

    const { conversationId, body, preview } = event.payload;
    const isOpen = this.active()?.id === conversationId;

    if (isOpen) {
      this.messages.update((rows) => [
        ...rows,
        {
          id: event.payload.messageId ?? `live-${Date.now()}`,
          body: body ?? preview ?? '',
          kind: 'TEXT',
          sender: event.payload.sender ?? null,
          mine: false,
          createdAt: event.payload.createdAt ?? new Date().toISOString(),
        },
      ]);
      this.scrollToLatest();
      this.clearUnread(conversationId);
      return;
    }

    // Not the open thread: bump it and raise its unread count. If it is a
    // conversation this session has never seen, refetch rather than invent one.
    const known = this.conversations().some((c) => c.id === conversationId);
    if (!known) {
      this.loadInbox();
      return;
    }

    this.conversations.update((rows) => {
      const found = rows.find((row) => row.id === conversationId);
      if (!found) return rows;
      const updated: IConversationSummary = {
        ...found,
        unread: found.unread + 1,
        lastMessage: {
          preview: body ?? preview ?? '',
          at: new Date().toISOString(),
          sender: event.payload.sender ?? null,
          mine: false,
          read: false,
        },
        updatedAt: new Date().toISOString(),
      };
      return [updated, ...rows.filter((row) => row.id !== conversationId)];
    });
  }

  /**
   * The other side opened the thread: turn one tick into two.
   *
   * The event carries WHEN they read, not WHICH messages, so everything of
   * mine sent at or before that moment is marked read in one pass. That is the
   * same rule the server uses to answer the question on a fresh page load, so
   * a live receipt and a reload agree.
   */
  private applyReadReceipt(event: IStreamEvent): void {
    const { conversationId } = event.payload;
    const readAt = new Date(event.payload.at ?? Date.now()).getTime();

    if (this.active()?.id === conversationId) {
      this.messages.update((rows) =>
        rows.map((row) =>
          row.mine && !row.read && new Date(row.createdAt).getTime() <= readAt
            ? { ...row, read: true }
            : row
        )
      );
    }

    this.conversations.update((rows) =>
      rows.map((row) => {
        if (row.id !== conversationId || !row.lastMessage?.mine) return row;
        const at = row.lastMessage.at;
        if (at && new Date(at).getTime() > readAt) return row;
        return { ...row, lastMessage: { ...row.lastMessage, read: true } };
      })
    );
  }

  /**
   * Which tick a message of mine shows: none while it is in flight or failed,
   * one once the server has it, two once it has been read.
   */
  tickFor(message: IMessage): 'none' | 'sent' | 'read' {
    if (!message.mine || message.pending || message.failed) return 'none';
    return message.read ? 'read' : 'sent';
  }

  /** The same question for an inbox row's newest message. */
  rowTickFor(conversation: IConversationSummary): 'none' | 'sent' | 'read' {
    const last = conversation.lastMessage;
    if (!last?.mine || conversation.kind === 'ANNOUNCEMENT') return 'none';
    return last.read ? 'read' : 'sent';
  }

  /**
   * Start a conversation.
   *
   * The picker returns a person; opening the thread is find-or-create, so
   * choosing somebody already spoken to lands in the existing conversation
   * rather than starting a second one beside it.
   */
  startConversation(): void {
    this.dialog
      .open(NewConversationComponent, {
        width: 'min(520px, 94vw)',
        panelClass: 'messaging-picker-panel',
        autoFocus: false,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (person: IDirectoryPerson | null | undefined) => {
          if (person) this.openWith(person);
        },
      });
  }

  private openWith(person: IDirectoryPerson): void {
    this.messaging
      .openWith(person.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          const id = String(resp.data?._id ?? '');
          if (!id) return;

          // Reload so the new thread is in the list with a real title, then
          // open it. Synthesising a row here would mean two places that know
          // how an inbox row is shaped.
          this.messaging
            .inbox()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (inbox) => {
                this.conversations.set([...inbox.data.conversations]);
                const found = inbox.data.conversations.find((c) => c.id === id);
                if (found) this.open(found);
              },
            });
        },
        error: (err) => {
          this.toast.showNotification(
            'error',
            'Could not start that conversation',
            err?.error?.message ?? 'Please try again.'
          );
        },
      });
  }

  compose(): void {
    this.dialog
      .open(AnnouncementComposerComponent, { width: 'min(640px, 92vw)' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sent) => {
          if (sent) this.loadInbox();
        },
      });
  }

  onDraftKey(event: KeyboardEvent): void {
    // Enter sends, Shift+Enter breaks the line — the convention everyone
    // already has in their fingers.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendDraft();
    }
  }

  private scrollToLatest(): void {
    // After the next paint, or the new bubble is not yet laid out.
    requestAnimationFrame(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  initialsFor(conversation: IConversationSummary): string {
    if (conversation.kind === 'ANNOUNCEMENT') return '📣';
    return (conversation.title ?? '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
