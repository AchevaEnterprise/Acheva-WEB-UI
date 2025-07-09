import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SideBarComponent } from './side-bar/side-bar.component';
import { ToolBarComponent } from './tool-bar/tool-bar.component';
import { Store } from '@ngrx/store';
import { AppState } from '../@core/store/app.state';
import { loadProfile } from '../@core/store/profile/profile.action';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, SideBarComponent, ToolBarComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit {
  private readonly store = inject(Store<AppState>);
  expanded = signal<boolean>(true);
  screenWidth = signal<number>(window.innerWidth);

  ngOnInit(): void {
    // When authenticated load user profile
    this.store.dispatch(loadProfile());
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
}
