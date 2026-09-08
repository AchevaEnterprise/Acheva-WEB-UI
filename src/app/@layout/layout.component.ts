import {
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { DEFAULT_INTERRUPTSOURCES, Idle } from '@ng-idle/core';
import { Keepalive } from '@ng-idle/keepalive';
import { Store } from '@ngrx/store';
import { AppState } from '../@core/store/app.state';
import { loadProfileLinkedAccounts } from '../@core/store/profile/profile.action';
import { linkedAccountsSelector } from '../@core/store/profile/profile.selector';
import { AuthenticationService } from '../@features/auth/service/auth.service';
import { MessagingService } from '../@features/messaging/services/messaging.service';
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly messaging = inject(MessagingService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Whether the routed page owns the whole viewport.
   *
   * Declared by the route as `data.fullBleed` rather than matched on the URL,
   * so adding a second such page is one line in the route table and nothing
   * here. The chat is the first: it scrolls two panes internally, and framing
   * it in the shell's padding produced an outer scrollbar around a page that
   * was already scrolling.
   */
  readonly fullBleed = signal<boolean>(false);

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
    this.trackFullBleedRoutes();

    // The chat listens for the whole session, not only while its page is open:
    // the sidebar badge has to move on the dashboard, and a message that
    // arrives while you are elsewhere must already be in hand when you
    // navigate over. Torn down with the shell, which is what sign-out destroys.
    this.messaging.start();
    this.destroyRef.onDestroy(() => this.messaging.stop());
    // this.store.dispatch(loadProfile());
  }

  /** Re-read the flag on every navigation, and once for the route we landed on. */
  private trackFullBleedRoutes(): void {
    this.fullBleed.set(this.routeWantsFullBleed());
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.fullBleed.set(this.routeWantsFullBleed()));
  }

  /**
   * Walk to the deepest activated route. The flag can be declared at any level
   * — a lazily loaded child sets it as readily as a top-level page — so the
   * whole branch is checked rather than only the leaf.
   */
  private routeWantsFullBleed(): boolean {
    let node: ActivatedRoute | null = this.route;
    while (node) {
      // `snapshot` is not populated on a child route until the navigation
      // that activates it has finished, and this runs once before that.
      if (node.snapshot?.data?.['fullBleed'] === true) return true;
      node = node.firstChild;
    }
    return false;
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
