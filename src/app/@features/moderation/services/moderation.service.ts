import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  IAddAttachmentPayload,
  IAssignModeratorPayload,
  ICreateModerationPayload,
  IListModerationsQuery,
  IModerationComment,
  IModerationListPage,
  IRejectPayload,
  IResultModeration,
  ISubmitOutcomePayload,
  IWithCommentPayload,
} from '../models/moderation.model';

type ModerationResponse = IAPIResponse<IResultModeration>;

@Injectable({
  providedIn: 'root',
})
export class ModerationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.BASE_URL}/moderations`;

  // ── Create ───────────────────────────────────────────────────────────────

  /**
   * `POST /moderations` — server derives `moderationScope` from the course
   * vs the CA's home department.
   */
  create(payload: ICreateModerationPayload): Observable<ModerationResponse> {
    return this.http.post<ModerationResponse>(this.baseUrl, payload);
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  list(
    query: IListModerationsQuery = {}
  ): Observable<IAPIResponse<IModerationListPage>> {
    let params = new HttpParams();
    if (query.status) params = params.append('status', query.status);
    if (query.moderationScope)
      params = params.append('moderationScope', query.moderationScope);
    if (query.studentId) params = params.append('studentId', query.studentId);
    if (query.departmentId)
      params = params.append('departmentId', query.departmentId);
    if (query.pendingForMe)
      params = params.append('pendingForMe', String(query.pendingForMe));
    if (query.page != null) params = params.append('page', String(query.page));
    if (query.limit != null)
      params = params.append('limit', String(query.limit));

    return this.http.get<IAPIResponse<IModerationListPage>>(this.baseUrl, {
      params,
    });
  }

  findOne(id: string): Observable<ModerationResponse> {
    return this.http.get<ModerationResponse>(`${this.baseUrl}/${id}`);
  }

  // ── CA actions ───────────────────────────────────────────────────────────

  submit(id: string): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/submit`,
      {}
    );
  }

  cancel(id: string): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/cancel`,
      {}
    );
  }

  publish(id: string): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/publish`,
      {}
    );
  }

  // ── Home HOD ─────────────────────────────────────────────────────────────

  /** CROSS_DEPARTMENT only. The offering dept is derived from the course. */
  homeHodApproveCross(
    id: string,
    body: IWithCommentPayload = {}
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/home-hod/approve-cross`,
      body
    );
  }

  /** INTERNAL only. */
  homeHodApproveInternal(
    id: string,
    body: IAssignModeratorPayload
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/home-hod/approve-internal`,
      body
    );
  }

  homeHodReject(
    id: string,
    body: IRejectPayload
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/home-hod/reject`,
      body
    );
  }

  /** Final return leg — both scopes. */
  homeHodForwardToCa(
    id: string,
    body: IWithCommentPayload = {}
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/home-hod/forward-to-ca`,
      body
    );
  }

  // ── Offering HOD ─────────────────────────────────────────────────────────

  offeringHodApprove(
    id: string,
    body: IAssignModeratorPayload
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/offering-hod/approve`,
      body
    );
  }

  offeringHodReject(
    id: string,
    body: IRejectPayload
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/offering-hod/reject`,
      body
    );
  }

  offeringHodForwardAfterDean(
    id: string,
    body: IWithCommentPayload = {}
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/offering-hod/forward-after-dean`,
      body
    );
  }

  // ── HOD review (shared) ──────────────────────────────────────────────────

  hodForwardToDean(
    id: string,
    body: IWithCommentPayload = {}
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/hod/forward-to-dean`,
      body
    );
  }

  // ── Moderator ────────────────────────────────────────────────────────────

  moderatorSubmit(
    id: string,
    body: ISubmitOutcomePayload
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/moderator/submit`,
      body
    );
  }

  // ── Dean ────────────────────────────────────────────────────────────────

  deanApprove(
    id: string,
    body: IWithCommentPayload = {}
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/dean/approve`,
      body
    );
  }

  deanReject(id: string, body: IRejectPayload): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/dean/reject`,
      body
    );
  }

  // ── Attachments ─────────────────────────────────────────────────────────

  addAttachment(
    id: string,
    body: IAddAttachmentPayload
  ): Observable<ModerationResponse> {
    return this.http.post<ModerationResponse>(
      `${this.baseUrl}/${id}/attachments`,
      body
    );
  }

  // ── Comments ────────────────────────────────────────────────────────────

  getComments(id: string): Observable<IAPIResponse<IModerationComment[]>> {
    return this.http.get<IAPIResponse<IModerationComment[]>>(
      `${this.baseUrl}/${id}/comments`
    );
  }

  postComment(
    id: string,
    comment: string
  ): Observable<IAPIResponse<IModerationComment>> {
    return this.http.post<IAPIResponse<IModerationComment>>(
      `${this.baseUrl}/${id}/comments`,
      { comment }
    );
  }
}
