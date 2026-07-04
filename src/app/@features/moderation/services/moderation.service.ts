import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import {
  IAddAttachmentPayload,
  ICreateModerationPayload,
  IListModerationsQuery,
  IModerationComment,
  IModerationEligibility,
  IModerationListPage,
  IRejectPayload,
  IResultModeration,
  ISubmitOutcomePayload,
  IUpdateDraftPayload,
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
   * vs the CA's home department. Use this when scope is unknown at call time.
   */
  create(payload: ICreateModerationPayload): Observable<ModerationResponse> {
    return this.http.post<ModerationResponse>(this.baseUrl, payload);
  }

  /**
   * `POST /moderations/internal` — course must be in the CA's own department.
   * Returns a clearer error than the generic endpoint when the scope is wrong.
   */
  createInternal(
    payload: ICreateModerationPayload
  ): Observable<ModerationResponse> {
    return this.http.post<ModerationResponse>(
      `${this.baseUrl}/internal`,
      payload
    );
  }

  /**
   * `POST /moderations/cross-department` — course must be in a different dept.
   * Returns a clearer error than the generic endpoint when the scope is wrong.
   */
  createCrossDepartment(
    payload: ICreateModerationPayload
  ): Observable<ModerationResponse> {
    return this.http.post<ModerationResponse>(
      `${this.baseUrl}/cross-department`,
      payload
    );
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

  /** Duplicate-initiation guard: can a fresh moderation be started? */
  eligibility(
    studentId: string,
    courseId: string
  ): Observable<IAPIResponse<IModerationEligibility>> {
    const params = new HttpParams()
      .append('studentId', studentId)
      .append('courseId', courseId);
    return this.http.get<IAPIResponse<IModerationEligibility>>(
      `${this.baseUrl}/eligibility`,
      { params }
    );
  }

  // ── CA actions ───────────────────────────────────────────────────────────

  submit(id: string): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/submit`,
      {}
    );
  }

  /** Edit a DRAFT's letter (submitting CA only). */
  updateDraft(
    id: string,
    body: IUpdateDraftPayload
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/draft`,
      body
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

  // ── HOD moderates inline (both scopes) ───────────────────────────────────

  /**
   * The reviewing HOD enters/generates the moderated scores themselves.
   * Internal → home HOD at PENDING_HOME_HOD; cross → offering HOD at
   * PENDING_OFFERING_HOD. Scores must total a grade of E (40–44).
   */
  hodModerate(
    id: string,
    body: ISubmitOutcomePayload
  ): Observable<ModerationResponse> {
    return this.http.patch<ModerationResponse>(
      `${this.baseUrl}/${id}/hod/moderate`,
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
