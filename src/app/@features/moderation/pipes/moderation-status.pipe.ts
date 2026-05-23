import { Pipe, PipeTransform } from '@angular/core';
import {
  ModerationStatus,
  IResultModeration,
} from '../models/moderation.model';
import {
  moderationStatusLabel,
  moderationStatusVariant,
} from '../utils/moderation-workflow';

/**
 * Display the human-readable label for any `ModerationStatus`. Accepts either
 * the raw status enum or a moderation document and reads `.status` from it.
 */
@Pipe({
  name: 'moderationStatus',
  standalone: true,
})
export class ModerationStatusPipe implements PipeTransform {
  transform(
    value: ModerationStatus | IResultModeration | null | undefined
  ): string {
    if (!value) return '';
    const status =
      typeof value === 'string' ? value : (value as IResultModeration).status;
    return moderationStatusLabel(status);
  }
}

/** Returns one of: 'draft' | 'pending' | 'rejected' | 'ready' | 'published' | 'cancelled'. */
@Pipe({
  name: 'moderationStatusVariant',
  standalone: true,
})
export class ModerationStatusVariantPipe implements PipeTransform {
  transform(
    value: ModerationStatus | IResultModeration | null | undefined
  ): string {
    if (!value) return 'pending';
    const status =
      typeof value === 'string' ? value : (value as IResultModeration).status;
    return moderationStatusVariant(status);
  }
}
