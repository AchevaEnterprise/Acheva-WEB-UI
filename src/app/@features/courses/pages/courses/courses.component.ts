import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';
import { LevelsEnum } from '../../../../@core/models/school.model';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { CourseCardComponent } from '../../components/course-card/course-card.component';
import { ICourse, ICourseTemplate } from '../../models/course.model';
import { CoursesService } from '../../services/courses.service';

@Component({
  selector: 'app-courses',
  imports: [
    SvgComponent,
    SearchInputComponent,
    CardComponent,
    EmptyStateComponent,
    MatDivider,
    CourseCardComponent,
    LoaderComponent,
    AsyncPipe,
    NgIf,
  ],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
})
export class CoursesComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthenticationService);
  private readonly courseService = inject(CoursesService);

  courseTemplates = signal<Partial<ICourseTemplate>[]>([]);
  RoleEnum = RoleEnum;
  activeAccount = this.authService.activeAccount;

  // Search functionality
  searchQuery = signal<string>('');
  private searchSubject = new BehaviorSubject<string>('');
  isSearching = signal(false);
  searchResults = signal<ICourse[]>([]);
  showSearchResults = signal(false);

  // View all functionality
  showAllCourses = signal(false);
  isLoadingAllCourses = signal(false);
  allCourses = signal<ICourse[]>([]);

  isloadingRecentCourses = signal(true);
  recentCourses$: Observable<ICourse[]> = this.courseService
    .getRecentCourses()
    .pipe(
      map((resp) => resp.data?.slice(0, 4)),
      finalize(() => this.isloadingRecentCourses.set(false))
    );

  isloadingCourses = signal(true);
  courses$: Observable<ICourse[]> = this.courseService.getCourses().pipe(
    map((resp) => resp.data['courses']),
    finalize(() => this.isloadingCourses.set(false))
  );

  // Search stream
  searchResults$ = this.searchSubject.pipe(
    debounceTime(800),
    distinctUntilChanged(),
    switchMap((query) => {
      if (!query.trim()) {
        this.showSearchResults.set(false);
        this.isSearching.set(false);
        return of([]);
      }

      this.isSearching.set(true);
      this.showSearchResults.set(true);

      // First try searching by course code only
      const courseCodeParams = {
        courseCode: query.trim(),
        courseTitle: '',
        // level: LevelsEnum.EXCEPTION,
      };

      return this.courseService.getCourses(courseCodeParams).pipe(
        switchMap((resp) => {
          const courses: ICourse[] = resp.data['courses'];

          if (courses.length > 0) {
            // Found results with course code search
            return of(courses);
          } else {
            // No results with course code, try course title
            const courseTitleParams = {
              courseCode: '',
              courseTitle: query.trim(),
              level: LevelsEnum.EXCEPTION,
            };

            return this.courseService
              .getCourses(courseTitleParams)
              .pipe(map((titleResp) => titleResp.data['courses'] || []));
          }
        }),
        finalize(() => this.isSearching.set(false))
      );
    })
  );

  constructor() {
    // Subscribe to search results
    this.searchResults$.subscribe((results) => {
      this.searchResults.set(results);
    });
  }

  createNewResult() {
    this.router.navigate(['details'], {
      relativeTo: this.route,
      queryParams: { new: true },
    });
  }

  createResult(course: Partial<ICourse>) {
    this.router.navigate(['details'], {
      relativeTo: this.route,
      queryParams: { courseId: course._id },
    });
  }

  onSearch(query: string) {
    this.searchQuery.set(query || '');
    this.searchSubject.next(query || '');

    // If query is empty, hide search results
    if (!query || !query.trim()) {
      this.showSearchResults.set(false);
    }
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchSubject.next('');
    this.showSearchResults.set(false);
  }

  viewAllCourses() {
    if (this.showAllCourses()) {
      this.showAllCourses.set(false);
      return;
    }

    this.showAllCourses.set(true);
    this.isLoadingAllCourses.set(true);

    // Fetch all courses without filters
    this.courseService.getCourses().subscribe({
      next: (resp) => {
        this.allCourses.set(resp.data['courses'] || []);
        this.isLoadingAllCourses.set(false);
      },
      error: (error) => {
        this.isLoadingAllCourses.set(false);
      },
    });
  }

  hideAllCourses() {
    this.showAllCourses.set(false);
  }
}
