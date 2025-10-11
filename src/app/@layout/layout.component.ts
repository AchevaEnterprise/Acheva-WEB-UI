import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { AppState } from '../@core/store/app.state';
import {
  loadProfile,
  loadProfileLinkedAccounts,
} from '../@core/store/profile/profile.action';
import { linkedAccountsSelector } from '../@core/store/profile/profile.selector';
import { AuthenticationService } from '../@features/auth/service/auth.service';
import { SideBarComponent } from './side-bar/side-bar.component';
import { ToolBarComponent } from './tool-bar/tool-bar.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, SideBarComponent, ToolBarComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit {
  private readonly store = inject(Store<AppState>);
  private readonly authService = inject(AuthenticationService);

  expanded = signal<boolean>(true);
  screenWidth = signal<number>(window.innerWidth);

  constructor() {
    this.authService.loadInitialSession();

    // this.store.select(state => state.profile).pipe(take(1)).subscribe(profileState => {
    //   if (!profileState) {
    //     const account = this.authService.activeAccount();
    //     if (account) {
    //       // Dispatch saveProfile with the activeAccount data but omit tokens
    //       const { accessToken, refreshToken, ...profileWithoutTokens } = account;
    //       this.store.dispatch(
    //         saveProfile({ profile: profileWithoutTokens })
    //       );
    //     } else {
    //       // If no local session, fetch from API
    //       this.store.dispatch(loadProfile());
    //     }
    //   }
    // });
  }

  ngOnInit(): void {
     //Delay API calls to allow proper authentication flow
    setTimeout(() => {
      if (this.authService.isAuthenticated) {
       this.store.dispatch(loadProfile());
         this.loadLinkedAccounts();
      }
    }, 1000);
   }

  loadLinkedAccounts() {
    this.store.dispatch(loadProfileLinkedAccounts());

    this.store.select(linkedAccountsSelector).subscribe({
      next: (accounts) => this.authService.accounts.set(accounts),
    });
  }

  onToggleSideNav(data: { expanded: boolean }) {
    this.expanded.set(data.expanded);
  }

  getBodyClass = computed(() => {
    let styleClass = '';
    const expanded = this.expanded();
    const screenWidth = this.screenWidth();

    if (expanded && screenWidth > 768)
      styleClass = 'w-[calc(100%_-_16.5625rem)] ml-[16.5625rem]';
    else if (expanded && screenWidth <= 768)
      styleClass = 'w-[calc(100%_-_5rem)] ml-[5rem]';

    return styleClass;
  });

  switchAccount(accountId: string) {
    this.authService.switchAccount(accountId).subscribe({
      next: (response) => {
        if (response.status) {
          // Reload the page to refresh the UI with new role
          window.location.reload();
        }
      },
      error: (error) => {
        console.error('Failed to switch account:', error);
      },
    });
  }
}
