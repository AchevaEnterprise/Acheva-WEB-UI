import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Store } from '@ngrx/store';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IAPIResponse } from '../../../@core/models/api-response.model';
import { STORAGE_KEYS } from '../../../@core/models/storage.model';
import { AppState } from '../../../@core/store/app.state';
import { saveProfile } from '../../../@core/store/profile/profile.action';
import {
  IAccessRefreshToken,
  IAccount,
  IAuthProfile,
  ILogIn,
  IResetPassword,
  ISignUp,
} from '../model/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly store = inject(Store<AppState>);
  private readonly jwtHelper: JwtHelperService = new JwtHelperService();

  private readonly authUrl = `${environment.BASE_URL}/auth`;

  accounts = signal<IAccount[]>([]);
  activeAccount = signal<IAccount | null>(null);

  setToken(token: string) {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  }

  get getToken() {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  setRefreshToken(refreshToken: string) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  get getRefreshToken() {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  public get isAuthenticated(): boolean {
    const token = this.getToken;

    if (token) return this.jwtHelper.isTokenExpired(token);
    return false;
  }

  public signIn(payload: ILogIn): Observable<IAPIResponse<IAuthProfile>> {
    return this.http
      .post<
        IAPIResponse<IAuthProfile>
      >(`${this.authUrl}/lecturers/signin`, payload)
      .pipe(
        tap((resp) => {
          const { accessToken, refreshToken } = resp.data;

          this.setToken(accessToken);
          this.setRefreshToken(refreshToken);

          // Sets the signal state for the active account
          this.activeAccount.set(resp.data);

          this.store.dispatch(
            saveProfile({
              profile: resp.data,
            })
          );
        })
      );
  }

  public signUp(payload: ISignUp): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(
      `${this.authUrl}/lecturers/register`,
      payload
    );
  }

  public getProfile() {
    return of(null);
  }

  loadInitialSession() {
    const account = localStorage.getItem(STORAGE_KEYS.ACTIVE_ACCOUNT);
    if (account) this.activeAccount.set(JSON.parse(account));
  }

  getLinkedAccounts(): Observable<IAPIResponse<IAccount[]>> {
    return this.http.get<IAPIResponse<IAccount[]>>(
      `${this.authUrl}/lecturers/linked-accounts`
    );
  }

  switchAccount(accountId: string): Observable<IAPIResponse<IAuthProfile>> {
    return this.http
      .post<
        IAPIResponse<IAuthProfile>
      >(`${this.authUrl}/lecturers/switch-account`, { accountId })
      .pipe(
        tap((res) => {
          const { accessToken, refreshToken } = res.data;

          this.setToken(accessToken);
          this.setRefreshToken(refreshToken);

          // Sets the signal state for the active account
          this.activeAccount.set(res.data);
          localStorage.setItem(
            STORAGE_KEYS.ACTIVE_ACCOUNT,
            JSON.stringify(this.activeAccount())
          );
        })
      );
  }

  forgotPassword(email: string): Observable<IAPIResponse<{ message: string }>> {
    return this.http.post<IAPIResponse<{ message: string }>>(
      `${this.authUrl}/forgot-password`,
      { email },
      { params: { accountType: 'LECTURER' } }
    );
  }

  resendEmailVerification(email: string): Observable<IAPIResponse<any>> {
    return this.http.post<IAPIResponse<any>>(
      `${this.authUrl}/resend-email-verification`,
      { email },
      { params: { accountType: 'LECTURER' } }
    );
  }

  confirmCode(token: string): Observable<IAPIResponse<{ token: string }>> {
    return this.http.patch<IAPIResponse<{ token: string }>>(
      `${this.authUrl}/verify-email`,
      { token }
    );
  }

  resetPassword(payload: IResetPassword): Observable<IAPIResponse<any>> {
    return this.http.patch<IAPIResponse<any>>(
      `${this.authUrl}/reset-password`,
      { payload }
    );
  }

  refreshToken(
    refreshToken: string
  ): Observable<IAPIResponse<IAccessRefreshToken>> {
    return this.http.post<IAPIResponse<IAccessRefreshToken>>(
      `${this.authUrl}/lecturers/refresh-token`,
      { refreshToken }
    );
  }

  logOut() {
    localStorage.clear();
    this.router.navigate(['auth']);
  }
}
