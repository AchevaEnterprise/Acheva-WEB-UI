import { NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { RoleAccessDirective } from '../../../../@core/directives/role-access.directive';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ICourse } from '../../../courses/models/course.model';
import { LecturersService } from '../../../user-settings/service/lecturer.service';
import { CommentComponent } from '../../components/comment/comment.component';
import { ResultManagementFileTableComponent } from '../../components/result-management-file-table/result-management-file-table.component';
import { ResultManagementFolderTableComponent } from '../../components/result-management-folder-table/result-management-folder-table.component';
import { ResultStatusTrackingComponent } from '../../components/result-status-tracking/result-status-tracking.component';
import { IResult, ResultStatusEnum } from '../../models/results.model';
import { ResultsService } from '../../services/results.service';

@Component({
  selector: 'app-result-management',
  imports: [
    NgClass,
    SegmentSwitcherComponent,
    ButtonComponent,
    ResultStatusTrackingComponent,
    CommentComponent,
    MatTooltipModule,
    CardComponent,
    ResultManagementFolderTableComponent,
    ResultManagementFileTableComponent,
    RoleAccessDirective,
  ],
  templateUrl: './result-management.component.html',
  styleUrl: './result-management.component.scss',
})
export class ResultManagementComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly resultService = inject(ResultsService);
  private readonly authService = inject(AuthenticationService);
  private readonly lecturerService = inject(LecturersService);

  results = signal<IResult[]>([]);
  currentRole = signal<RoleEnum>(this.authService.activeAccount()!.role);
  departmentLecturers = signal<any[]>([]);

  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Drafts',
      value: 'DRAFT',
      accessRole: [RoleEnum.LECTURER, RoleEnum.COURSE_COORDINATOR],
    },
    {
      label: 'Pending',
      value: 'PENDING',
      accessRole: [
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Unverified',
      value: 'UNVERIFIED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Verified',
      value: 'VERIFIED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Published',
      value: 'PUBLISHED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Imported',
      value: 'IMPORTED',
      accessRole: [RoleEnum.DEAN, RoleEnum.HOD, RoleEnum.COURSE_ADVISOR],
    },
  ]);
  activeSegment = signal<ISegmentSwitcher>(
    this.currentRole() === RoleEnum.HOD
      ? this.segments()[1]
      : this.segments()[0]
  );
  segmentCardLabel = signal<string>('Access your recent drafts from here');
  segmentCardIconSrc = signal<string>('icons/general/draft-icon.svg');

  expandView = signal<boolean>(false);

  RoleEnum = RoleEnum;

  ngOnInit(): void {
    this.loadDepartmentLecturers();
    this.getResults();
  }

  private loadDepartmentLecturers() {
    const currentUser = this.authService.activeAccount();
    if (currentUser?.department) {
      this.lecturerService.getLecturersInDepartment(currentUser.department).subscribe({
        next: (resp) => {
          if (resp.status) {
            this.departmentLecturers.set(resp.data);
          }
        },
        error: (error) => {
          console.warn('Failed to load department lecturers:', error);
        }
      });
    }
  }

  getResults() {
    // Load from localStorage for DRAFT segment
    if (this.activeSegment().value === 'DRAFT') {
      this.loadDraftResults();
      return;
    }

    // Load completed results from localStorage first, then API
    this.loadCompletedResultsFromLocalStorage();

    this.resultService
      .getResults({
        status: this.activeSegment().value,
      })
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            console.log('API Response:', resp.data.result);
            // Enhance API results with proper course codes and lecturer data
            const enhancedResults = resp.data.result.map((result: any) => {
              console.log('Processing API result:', result);
              
              // Extract course code from multiple sources
              let courseCode = result.course?.courseCode ||
                              result.courseCode ||
                              this.extractCourseCodeFromTitle(result.course?.courseTitle || '') ||
                              this.extractCourseCodeFromTitle(result.courseTitle || '');
              
              // If still no course code, create one from result ID
              if (!courseCode) {
                courseCode = 'COURSE_' + (result._id?.slice(-4) || 'XXXX');
              }
              
              const enhanced = {
                ...result,
                course: {
                  ...result.course,
                  courseCode: courseCode
                },
                lecturer: this.getLecturerName(result.lecturer || result.uploadedBy || result.createdBy?.fullName) || 'Unknown Lecturer',
                createdAt: result.createdAt || new Date(),
                updatedAt: result.updatedAt || new Date()
              };
              console.log('Enhanced result with course code:', courseCode);
              return enhanced;
            });
            
            // Merge localStorage results with API results
            const currentResults = this.results();
            const mergedResults = [...currentResults, ...enhancedResults];
            this.results.set(mergedResults);
          }
        },
      });
  }

  private loadDraftResults() {
    // Load from localStorage first for completed drafts
    this.loadDraftResultsFromLocalStorage();
    
    // Then load from API and merge
    this.resultService
      .getResults({
        status: 'DRAFT',
      })
      .subscribe({
        next: (resp) => {
          if (resp.status && resp.data.result) {
            const enhancedResults = resp.data.result.map((result: any) => {
              const enhanced = {
                ...result,
                course: {
                  ...result.course,
                  courseCode: result.course?.courseCode || this.extractCourseCodeFromTitle(result.course?.courseTitle || '') || 'COURSE001'
                },
                lecturer: this.getLecturerName(result.lecturer || result.uploadedBy || result.createdBy?.fullName) || 'Unknown Lecturer',
                createdAt: result.createdAt || new Date(),
                updatedAt: result.updatedAt || new Date(),
                isDraft: true
              };
              return enhanced;
            });
            
            // Merge with localStorage results
            const currentResults = this.results();
            const mergedResults = [...currentResults, ...enhancedResults];
            this.results.set(mergedResults);
          }
        },
        error: (error) => {
          console.warn('Failed to load drafts from API:', error);
        }
      });
  }

  private loadCompletedResultsFromLocalStorage() {
    const resultManagementList = JSON.parse(localStorage.getItem('result_management_list') || '[]');
    
    // Filter results that match current segment status
    const completedResults = resultManagementList
      .filter((item: any) => item.status === this.activeSegment().value)
      .map((item: any) => {
        const currentUser = this.authService.activeAccount();
        
        return {
          _id: item.resultId,
          course: {
            courseTitle: item.courseTitle || 'Unknown Course',
            courseCode: item.courseCode || 'COURSE001'
          },
          session: item.session || 'Unknown Session',
          level: item.level || 'Unknown Level',
          status: this.mapStatusToEnum(this.activeSegment().value),
          createdAt: new Date(item.timestamp || new Date()),
          updatedAt: new Date(item.lastModified || item.timestamp || new Date()),
          school: { _id: 'default', name: 'Default School' },
          isApproved: false,
          comments: [],
          department: {
            name: item.department || 'Mathematics'
          },
          faculty: item.faculty || 'Faculty of Engineering',
          lecturer: item.lecturer || (currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'Dr. John Smith'),
          semester: item.semester || '1st Semester',
          uploadedBy: item.uploadedBy || (currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'Unknown User'),
          createdBy: {
            fullName: item.uploadedBy || (currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'Unknown User')
          },
          studentCount: item.totalStudents || 0,
          studentsWithGrades: item.studentsWithGrades || 0,
          completionPercentage: item.completionPercentage || 0,
          isFromLocalStorage: true
        };
      });
    
    this.results.set(completedResults);
  }

  private loadDraftResultsFromLocalStorage() {
    const resultManagementList = JSON.parse(localStorage.getItem('result_management_list') || '[]');
    const resultDraftsList = JSON.parse(localStorage.getItem('result_drafts_list') || '[]');
    
    // Combine both lists, prioritizing completed results from result_management_list
    const allDrafts = [...resultManagementList.filter((item: any) => item.status === 'DRAFT'), ...resultDraftsList];
    
    if (allDrafts.length === 0) {
      this.results.set([]);
      return;
    }
    
    // Remove duplicates, keeping the first occurrence (completed results take priority)
    const uniqueDrafts = allDrafts.filter((item, index, self) => 
      index === self.findIndex(t => t.resultId === item.resultId)
    );
    
    const draftResults = uniqueDrafts.map((item: any) => {
      const currentUser = this.authService.activeAccount();
      
      return {
        _id: item.resultId,
        course: {
          courseTitle: item.courseTitle || 'Unknown Course',
          courseCode: item.courseCode || 'COURSE001'
        },
        session: item.session || 'Unknown Session',
        level: item.level || 'Unknown Level',
        status: ResultStatusEnum.DRAFT,
        createdAt: new Date(item.timestamp || new Date()),
        updatedAt: new Date(item.lastModified || item.timestamp || new Date()),
        school: { _id: 'default', name: 'Default School' },
        isApproved: false,
        comments: [],
        department: {
          name: item.department || 'Mathematics'
        },
        faculty: item.faculty || 'Faculty of Engineering',
        lecturer: currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'Dr. John Smith',
        semester: item.semester || '1st Semester',
        uploadedBy: currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'Unknown User',
        createdBy: {
          fullName: currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'Unknown User'
        },
        isDraft: true,
        studentCount: item.totalStudents || 0,
        studentsWithGrades: item.studentsWithGrades || 0,
        completionPercentage: item.completionPercentage || 0
      };
    });
    
    this.results.set(draftResults);
  }

  private mapStatusToEnum(segmentValue: string): ResultStatusEnum {
    switch (segmentValue) {
      case 'DRAFT': return ResultStatusEnum.DRAFT;
      case 'PENDING': return ResultStatusEnum.PENDING;
      case 'UNVERIFIED': return ResultStatusEnum.PENDING;
      case 'VERIFIED': return ResultStatusEnum.APPROVED;
      case 'PUBLISHED': return ResultStatusEnum.APPROVED;
      default: return ResultStatusEnum.PENDING;
    }
  }

  toggleView() {
    this.expandView.update((prev) => !prev);
  }

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    switch (switchValue) {
      case 'DRAFT': {
        this.segmentCardLabel.set('Access your recent drafts from here');
        this.segmentCardIconSrc.set('icons/general/draft-icon.svg');
        break;
      }
      case 'PENDING': {
        this.segmentCardLabel.set('Access your pending results from here');
        this.segmentCardIconSrc.set('icons/general/pending-icon.svg');
        break;
      }
      case 'UNVERIFIED': {
        this.segmentCardLabel.set('Access your unverified results from here');
        this.segmentCardIconSrc.set('icons/general/unverified-icon.svg');
        break;
      }
      case 'VERIFIED': {
        this.segmentCardLabel.set('Access your verified results from here');
        this.segmentCardIconSrc.set('icons/general/verified-icon.svg');
        break;
      }
      case 'PUBLISHED': {
        this.segmentCardLabel.set('Access your published results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
    }

    this.getResults();
  }

  sendToCC() {
    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You're about to send this result to the Course Coordinator. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (file: File | null) => {
          if (file) {
            console.warn('Uploaded File: ', file);
          }
        },
      });
  }

  sendToHOD() {
    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: `You're about to send this result to the Head of Department. This action is irreversible, Are you sure you want to continue?`,
        },
      })
      .afterClosed()
      .subscribe({
        next: (file: File | null) => {
          if (file) {
            console.warn('Uploaded File: ', file);
          }
        },
      });
  }

  viewResult(course: ICourse) {
    // For DRAFT segment, navigate to result-upload to view/edit
    if (this.activeSegment().value === 'DRAFT') {
      this.router.navigate(['/my-result/upload-result'], {
        queryParams: { resultId: course._id },
      });
      return;
    }

    // For completed results from localStorage, navigate to approve-reject-result
    if ((course as any).isFromLocalStorage) {
      this.router.navigate(['approve-reject-result'], {
        relativeTo: this.route,
        queryParams: { resultId: course._id },
      });
      return;
    }

    this.router.navigate(['verify-result'], {
      relativeTo: this.route,
      queryParams: { resultId: course._id },
    });
  }

  private extractCourseCodeFromTitle(courseTitle: string): string {
    if (!courseTitle) return '';
    
    // Enhanced patterns from result-upload component
    const codePatterns = [
      /^([A-Z]{2,4}\s*\d{3})/i,  // CSC 101, ENG101
      /^([A-Z]{2,4}-\d{3})/i,    // CSC-101
      /^([A-Z]{2,4}\/\d{3})/i,   // CSC/101
      /\b([A-Z]{2,4}\s*\d{3})\b/i, // Anywhere in title
      /([A-Z]{2,4}\d{3})/i       // MTH103, CSC201
    ];

    for (const pattern of codePatterns) {
      const match = courseTitle.match(pattern);
      if (match) {
        return match[1].replace(/\s+/g, '').toUpperCase();
      }
    }

    // If no pattern found, return first word if it looks like a code
    const words = courseTitle.split(' ');
    const firstWord = words[0];
    if (firstWord && /^[A-Z]{2,4}$/i.test(firstWord) && words[1] && /^\d{3}$/.test(words[1])) {
      return (firstWord + words[1]).toUpperCase();
    }

    return '';
  }

  private getLecturerName(lecturerIdentifier: string | undefined): string {
    if (!lecturerIdentifier) {
      return 'Unknown Lecturer';
    }
    
    // If it's already a full name (contains space), return it
    if (lecturerIdentifier.includes(' ') && !lecturerIdentifier.match(/^[a-f0-9]{24}$/)) {
      return lecturerIdentifier;
    }
    
    // Try to find lecturer in department lecturers list by ID
    const lecturer = this.departmentLecturers().find(l => 
      l._id === lecturerIdentifier || 
      l.email === lecturerIdentifier
    );
    
    if (lecturer) {
      return `${lecturer.firstname} ${lecturer.lastname}`;
    }
    
    // If not found and looks like an ID, fetch from API
    if (lecturerIdentifier.match(/^[a-f0-9]{24}$/)) {
      this.fetchLecturerById(lecturerIdentifier);
      return 'Loading...';
    }
    
    return lecturerIdentifier;
  }

  private fetchLecturerById(lecturerId: string) {
    this.lecturerService.getLecturer(lecturerId).subscribe({
      next: (resp) => {
        if (resp.status && resp.data) {
          // Update the results with the fetched lecturer name
          this.results.update(currentResults => 
            currentResults.map(result => {
              if (result.lecturer === lecturerId || result.uploadedBy === lecturerId) {
                return {
                  ...result,
                  lecturer: `${resp.data.firstname} ${resp.data.lastname}`
                };
              }
              return result;
            })
          );
        }
      },
      error: (error) => {
        console.warn('Failed to fetch lecturer:', error);
      }
    });
  }
}
