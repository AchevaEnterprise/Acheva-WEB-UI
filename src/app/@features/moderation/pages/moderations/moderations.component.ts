import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SkeletonTableComponent } from '../../../../@shared/components/skeleton/skeleton-table.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import {
  IListModerationsQuery,
  IResultModeration,
  ModerationStatus,
} from '../../models/moderation.model';
import {
  ModerationStatusPipe,
  ModerationStatusVariantPipe,
} from '../../pipes/moderation-status.pipe';
import { ModerationInboxBadgeService } from '../../services/moderation-inbox-badge.service';
import { ModerationService } from '../../services/moderation.service';
import { refId } from '../../utils/moderation-workflow';
import { ICourse } from '../../../courses/models/course.model';
import { IStudent } from '../../../students/models/student.model';

interface ITab {
  id: 'INBOX' | 'DRAFT' | 'PUBLISHED' | 'ALL';
  label: string;
  hint: string;
  query: IListModerationsQuery;
}

@Component({
  selector: 'app-moderations',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
    ButtonComponent,
    SkeletonTableComponent,
    ModerationStatusPipe,
    ModerationStatusVariantPipe,
  ],
  templateUrl: './moderations.component.html',
  styleUrl: './moderations.component.scss',
})
export class ModerationsComponent implements OnInit {
  private readonly moderationService = inject(ModerationService);
  private readonly authService = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly moderationInboxBadge = inject(ModerationInboxBadgeService);

  readonly tabs: ITab[] = [
    {
      id: 'INBOX',
      label: 'My turn',
      hint: 'Requests waiting for an action from you.',
      query: { pendingForMe: true, limit: 50 },
    },
    {
      id: 'DRAFT',
      label: 'Drafts',
      hint: 'Requests you started but have not submitted yet.',
      query: { status: ModerationStatus.DRAFT, limit: 50 },
    },
    {
      id: 'PUBLISHED',
      label: 'Published',
      hint: 'Moderations that have been published to student records.',
      query: { status: ModerationStatus.PUBLISHED, limit: 50 },
    },
    {
      id: 'ALL',
      label: 'All',
      hint: 'Every moderation request you can see.',
      query: { limit: 50 },
    },
  ];

  loading = signal<boolean>(false);
  rows = signal<IResultModeration[]>([]);
  activeTabId = signal<ITab['id']>('INBOX');

  activeTab = computed<ITab>(
    () => this.tabs.find((t) => t.id === this.activeTabId()) ?? this.tabs[0]
  );

  ngOnInit(): void {
    this.fetch();
  }

  switchTab(id: ITab['id']): void {
    if (this.activeTabId() === id) return;
    this.activeTabId.set(id);
    this.fetch();
  }

  refresh(): void {
    this.fetch();
  }

  private fetch(): void {
    this.loading.set(true);
    this.moderationService
      .list(this.activeTab().query)
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.moderationInboxBadge.refresh();
        })
      )
      .subscribe({
        next: (resp) => {
          if (resp.status) this.rows.set(resp.data?.data ?? []);
        },
        error: () => {
          this.toast.showNotification(
            'error',
            'Could not load moderations',
            'Unable to load the moderation list. Please try again.'
          );
          this.rows.set([]);
        },
      });
  }

  open(mod: IResultModeration): void {
    void this.router.navigate(['/moderation', mod._id]);
  }

  /** Highlight rows where the signed-in lecturer is the current handler. */
  isMyTurn(mod: IResultModeration): boolean {
    const id = this.authService.activeAccount()?.id;
    if (!id) return false;
    return refId(mod.currentHandler) === id;
  }

  courseLabel(mod: IResultModeration): string {
    if (typeof mod.course === 'string') return '—';
    const c = mod.course as ICourse;
    return [c.courseCode, c.courseTitle].filter(Boolean).join(' · ');
  }

  studentLabel(mod: IResultModeration): string {
    if (typeof mod.student === 'string') return '—';
    const s = mod.student as IStudent;
    return s.fullName ?? s.registrationNumber ?? '—';
  }

  scopeLabel(mod: IResultModeration): string {
    return mod.moderationScope === 'INTERNAL' ? 'Internal' : 'Cross-dept';
  }

  trackRow(_index: number, mod: IResultModeration): string {
    return mod._id;
  }
}
