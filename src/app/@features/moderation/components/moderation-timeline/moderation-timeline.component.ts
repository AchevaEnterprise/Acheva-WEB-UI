import { Component, computed, input } from '@angular/core';
import { IResultModeration } from '../../models/moderation.model';
import {
  buildModerationTimeline,
  IModerationTimelineStep,
} from '../../utils/moderation-workflow';

/**
 * Renders the moderation flow as a vertical timeline. Steps are computed from
 * {@link buildModerationTimeline} so the same logic drives both this component
 * and any other view that needs to know "where are we in the flow?".
 */
@Component({
  selector: 'app-moderation-timeline',
  standalone: true,
  imports: [],
  templateUrl: './moderation-timeline.component.html',
  styleUrl: './moderation-timeline.component.scss',
})
export class ModerationTimelineComponent {
  moderation = input.required<IResultModeration>();

  steps = computed<IModerationTimelineStep[]>(() =>
    buildModerationTimeline(this.moderation())
  );
}
