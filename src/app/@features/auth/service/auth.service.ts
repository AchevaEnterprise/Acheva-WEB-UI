import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { of, tap } from 'rxjs';
import { STORAGE_KEYS } from '../../../@core/models/storage.model';
import { IAccount, ILogIn, ISignUp } from '../model/auth.model';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly jwtHelper: JwtHelperService = new JwtHelperService();

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

  public signIn(payload: ILogIn) {}

  public signUp(payload: ISignUp) {}

  public getProfile() {
    return of(null);
  }

  loadInitialSession() {
    const account = localStorage.getItem(STORAGE_KEYS.ACTIVE_ACCOUNT);
    if (account) this.activeAccount.set(JSON.parse(account));
  }

  // An Idea of what to do when switching accounts
  switchAccount(accountId: string) {
    return this.http
      .post<{
        token: string;
        account: IAccount;
      }>('/api/switch-account', { accountId })
      .pipe(
        tap((res) => {
          this.activeAccount.set(res.account);

          localStorage.setItem(STORAGE_KEYS.TOKEN, res.token);
          localStorage.setItem(
            STORAGE_KEYS.ACTIVE_ACCOUNT,
            JSON.stringify(res.account)
          );
        })
      );
  }

  logOut() {
    localStorage.clear();
    this.router.navigate(['auth']);
  }
}
