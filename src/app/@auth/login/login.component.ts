import { Component } from '@angular/core';
// import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthBannerComponent } from '../auth-banner/auth-banner.component';

@Component({
  selector: 'app-login',
  imports: [AuthBannerComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {}
