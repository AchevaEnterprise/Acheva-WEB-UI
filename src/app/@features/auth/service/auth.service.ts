import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { ILogIn, ISignUp } from '../model/auth.model';
import { STORAGE_KEYS } from '../../@core/models/storage.model';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  //   private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly jwtHelper: JwtHelperService = new JwtHelperService();

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

  logOut() {
    localStorage.clear();
    this.router.navigate(['auth']);
  }
}
