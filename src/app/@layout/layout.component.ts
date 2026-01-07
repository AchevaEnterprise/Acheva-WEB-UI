import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DEFAULT_INTERRUPTSOURCES, Idle } from '@ng-idle/core';
import { Keepalive } from '@ng-idle/keepalive';
import { Store } from '@ngrx/store';
import { AppState } from '../@core/store/app.state';
import { loadProfileLinkedAccounts } from '../@core/store/profile/profile.action';
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
  private readonly idle = inject(Idle);
  private readonly keepalive = inject(Keepalive);

  expanded = signal<boolean>(true);
  screenWidth = signal<number>(window.innerWidth);

  idleState = 'Not started.';
  timedOut = false;
  lastPing: Date | null = null;
  countDown: number | null = null;

  constructor() {
    this.setupIdleTimeout();
  }

  ngOnInit(): void {
    this.authService.loadInitialSession();
    this.loadLinkedAccounts();
    // this.store.dispatch(loadProfile());
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

  setupIdleTimeout() {
    // set idle time: 30 minutes = 1800 seconds
    this.idle.setIdle(1800);

    // set timeout period: 30 seconds after idle
    this.idle.setTimeout(10);

    // set what interrupts the idle state (e.g., clicks, scrolls, touches)
    this.idle.setInterrupts(DEFAULT_INTERRUPTSOURCES);

    // when user becomes idle
    this.idle.onIdleStart.subscribe(() => {
      this.idleState = 'You’ve been idle.';
      console.warn(this.idleState);
    });

    // when timeout countdown starts
    this.idle.onTimeoutWarning.subscribe((countdown) => {
      this.idleState = `You will be logged out in ${countdown} seconds!`;
      this.countDown = countdown;
      this.confirmLogout();
    });

    // when timed out
    this.idle.onTimeout.subscribe(() => {
      this.idleState = 'Timed out!';
      this.timedOut = true;
      console.warn('Logging out due to inactivity...');
      this.authService.logOut();
    });

    // reset if user comes back before timeout
    this.idle.onIdleEnd.subscribe(() => {
      this.idleState = 'No longer idle.';
      console.warn(this.idleState);
    });

    // keepalive ping every 5 minutes
    this.keepalive.interval(300);
    this.keepalive.onPing.subscribe(() => (this.lastPing = new Date()));

    this.reset();
  }

  confirmLogout() {
    const answer = confirm(
      `You'll be logged out in ${this.countDown} seconds due to inactivity.`
    );

    if (answer) this.authService.logOut();
    else this.reset();
  }

  reset() {
    this.idle.watch();
    this.idleState = 'Started.';
    this.timedOut = false;
  }
}
