import { NgClass } from '@angular/common';
import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../../../@core/utility/toast.service';
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
import { NotificationService } from '../../../notifications/service/notification.service';
import { CommentComponent } from '../../components/comment/comment.component';
import { ResultManagementFileTableComponent } from '../../components/result-management-file-table/result-management-file-table.component';
import { ResultManagementFolderTableComponent } from '../../components/result-management-folder-table/result-management-folder-table.component';
import { ResultStatusTrackingComponent } from '../../components/result-status-tracking/result-status-tracking.component';
import { IResult, ResultStatusEnum } from '../../models/results.model';
import { ResultsService } from '../../services/results.service';

@Component({
  selector: 'app-result-management',
  standalone: true,
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
  private readonly notificationService = inject(NotificationService);
  private readonly toast = inject(ToastService);

  folderTableRef = viewChild<ResultManagementFolderTableComponent>('folderTableRef');
  fileTableRef = viewChild<ResultManagementFileTableComponent>('fileTableRef');

  results = signal<IResult[]>([]);
  currentRole = signal<RoleEnum>(this.authService.activeAccount()!.role);
  departmentLecturers = signal<any[]>([]);
  sendingToCC = signal<boolean>(false);

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
      label: 'Approved',
      value: 'APPROVED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Complete',
      value: 'COMPLETE',
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
    this.loadNotifications();
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
              
              console.log('Final course code for result:', courseCode, 'from result:', result);
              
              // Debug: Log what we're actually setting
              console.log('Setting course code in enhanced result:', courseCode);
              console.log('Original result course object:', result.course);
              console.log('Original result courseCode:', result.courseCode);
              
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
            
            // Merge localStorage results with API results, removing duplicates
            const currentResults = this.results();
            const mergedResults = this.deduplicateResults([...currentResults, ...enhancedResults]);
            this.results.set(mergedResults);
          }
        },
      });
  }

  private loadDraftResults() {
    const currentUser = this.authService.activeAccount();
    
    // Load from localStorage first for completed drafts
    this.loadDraftResultsFromLocalStorage();
    
    // Get sent result IDs to exclude from API results
    const resultManagementList = JSON.parse(localStorage.getItem('result_management_list') || '[]');
    const sentToCCIds = resultManagementList
      .filter((item: any) => item.sentToCC === true)
      .map((item: any) => item.resultId);
    
    console.log('Sent to CC IDs:', sentToCCIds);
    
    // Then load from API and merge
    this.resultService
      .getResults({
        status: ResultStatusEnum.DRAFT,
      })
      .subscribe({
        next: (resp) => {
          if (resp.status && resp.data.result) {
            console.log('API Draft results before filtering:', resp.data.result);
            
            // For LECTURERS: Filter out results that have been sent to CC
            // For COURSE_COORDINATORS: Only show results sent to them
            let availableApiResults;
            
            if (currentUser?.role === RoleEnum.LECTURER) {
              // Lecturers should NOT see results they've sent to CC
              availableApiResults = resp.data.result.filter((result: any) => {
                const isSent = sentToCCIds.includes(result._id);
                console.log(`Lecturer view - Result ${result._id} (${result.course?.courseTitle}) - Sent to CC: ${isSent}`);
                return !isSent;
              });
            } else if (currentUser?.role === RoleEnum.COURSE_COORDINATOR) {
              // Course Coordinators should ONLY see results sent to them
              availableApiResults = resp.data.result.filter((result: any) => {
                const isSent = sentToCCIds.includes(result._id);
                console.log(`CC view - Result ${result._id} (${result.course?.courseTitle}) - Sent to CC: ${isSent}`);
                return isSent;
              });
            } else {
              // Other roles see all drafts
              availableApiResults = resp.data.result;
            }
            
            console.log('Available API results after filtering:', availableApiResults);
            
            const enhancedResults = availableApiResults.map((result: any) => {
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
            
            // Merge with localStorage results, removing duplicates
            const currentResults = this.results();
            const mergedResults = this.deduplicateResults([...currentResults, ...enhancedResults]);
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
    const currentUser = this.authService.activeAccount();
    
    // Filter results that match current segment status and user role
    let completedResults;
    
    if (this.activeSegment().value === 'DRAFT') {
      if (currentUser?.role === RoleEnum.LECTURER) {
        // Lecturers should NOT see results they've sent to CC
        completedResults = resultManagementList.filter((item: any) => 
          item.status === ResultStatusEnum.DRAFT && !item.sentToCC
        );
      } else if (currentUser?.role === RoleEnum.COURSE_COORDINATOR) {
        // Course Coordinators should ONLY see results sent to them
        completedResults = resultManagementList.filter((item: any) => 
          item.status === ResultStatusEnum.DRAFT && item.sentToCC === true
        );
      } else {
        // Other roles see all drafts
        completedResults = resultManagementList.filter((item: any) => item.status === ResultStatusEnum.DRAFT);
      }
    } else {
      // For non-DRAFT statuses, show all results matching the status
      completedResults = resultManagementList.filter((item: any) => item.status === this.activeSegment().value);
    }
    
    const processedResults = completedResults
      .map((item: any) => {
        const currentUser = this.authService.activeAccount();
        
        // Fix bad course codes
        let courseCode = item.courseCode;
        if (courseCode === 'Real' || courseCode === '' || !courseCode) {
          courseCode = this.extractCourseCodeFromTitle(item.courseTitle || '') || 'MATH101';
        }
        
        return {
          _id: item.resultId,
          courseCode: courseCode,
          courseTitle: item.courseTitle,
          course: {
            courseTitle: item.courseTitle,
            courseCode: courseCode
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
    
    this.results.set(processedResults);
  }

  private loadDraftResultsFromLocalStorage() {
    const currentUser = this.authService.activeAccount();
    const resultManagementList = JSON.parse(localStorage.getItem('result_management_list') || '[]');
    const resultDraftsList = JSON.parse(localStorage.getItem('result_drafts_list') || '[]');
    
    console.log('Loading drafts from localStorage:');
    console.log('result_management_list:', resultManagementList);
    console.log('result_drafts_list:', resultDraftsList);
    
    // Get IDs of results that have been sent to CC
    const sentToCCIds = resultManagementList
      .filter((item: any) => item.sentToCC === true)
      .map((item: any) => item.resultId);
    
    console.log('Sent to CC IDs from localStorage:', sentToCCIds);
    
    let availableDrafts;
    
    if (currentUser?.role === RoleEnum.LECTURER) {
      // Lecturers should NOT see results they've sent to CC
      availableDrafts = [
        ...resultManagementList.filter((item: any) => item.status === ResultStatusEnum.DRAFT && !item.sentToCC),
        ...resultDraftsList.filter((item: any) => !sentToCCIds.includes(item.resultId))
      ];
    } else if (currentUser?.role === RoleEnum.COURSE_COORDINATOR) {
      // Course Coordinators should ONLY see results sent to them
      availableDrafts = resultManagementList.filter((item: any) => item.status === ResultStatusEnum.DRAFT && item.sentToCC === true);
    } else {
      // Other roles see all drafts
      availableDrafts = [
        ...resultManagementList.filter((item: any) => item.status === ResultStatusEnum.DRAFT),
        ...resultDraftsList
      ];
    }
    
    console.log('Available drafts after filtering:', availableDrafts.length);
    
    if (availableDrafts.length === 0) {
      // Don't clear results here, let API results load
      return;
    }
    
    // Remove duplicates, keeping the first occurrence
    const uniqueDrafts = availableDrafts.filter((item: any, index: number, self: any[]) => 
      index === self.findIndex((t: any) => t.resultId === item.resultId)
    );
    
    const draftResults = uniqueDrafts.map((item: any) => {
      const currentUser = this.authService.activeAccount();
      
      // Fix bad course codes
      let courseCode = item.courseCode;
      if (courseCode === 'Real' || courseCode === '' || !courseCode) {
        courseCode = this.extractCourseCodeFromTitle(item.courseTitle || '') || 'MATH101';
      }
      
      return {
        _id: item.resultId,
        courseCode: courseCode,
        course: {
          courseTitle: item.courseTitle || 'Unknown Course',
          courseCode: courseCode
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
        completionPercentage: item.completionPercentage || 0,
        isFromLocalStorage: true
      };
    });
    
    console.log('Processed draft results from localStorage:', draftResults.length);
    this.results.set(draftResults);
  }

  /** Map segment filter value 1:1 to API `ResultStatus` */
  private mapStatusToEnum(segmentValue: string): ResultStatusEnum {
    switch (segmentValue) {
      case 'DRAFT':
        return ResultStatusEnum.DRAFT;
      case 'PENDING':
        return ResultStatusEnum.PENDING;
      case 'UNVERIFIED':
        return ResultStatusEnum.UNVERIFIED;
      case 'VERIFIED':
        return ResultStatusEnum.VERIFIED;
      case 'APPROVED':
        return ResultStatusEnum.APPROVED;
      case 'COMPLETE':
        return ResultStatusEnum.COMPLETE;
      case 'PUBLISHED':
        return ResultStatusEnum.PUBLISHED;
      case 'IMPORTED':
        return ResultStatusEnum.IMPORTED;
      default:
        return ResultStatusEnum.PENDING;
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
      case 'APPROVED': {
        this.segmentCardLabel.set('Access approved results from here');
        this.segmentCardIconSrc.set('icons/general/verified-icon.svg');
        break;
      }
      case 'COMPLETE': {
        this.segmentCardLabel.set('Access complete results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
      case 'PUBLISHED': {
        this.segmentCardLabel.set('Access your published results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
      case 'IMPORTED': {
        this.segmentCardLabel.set('Access imported results from here');
        this.segmentCardIconSrc.set('icons/general/published-icon.svg');
        break;
      }
    }

    this.getResults();
  }

  sendToCC() {
    // Lecturers use file table, Course Coordinators use folder table
    const currentUser = this.authService.activeAccount();
    let selectedResults: IResult[] = [];
    
    if (currentUser?.role === RoleEnum.LECTURER) {
      const fileTable = this.fileTableRef();
      if (!fileTable) {
        console.error('File table reference not found');
        this.toast.showNotification('error', 'Error', 'Unable to access results table');
        return;
      }
      selectedResults = fileTable.selection.selected;
    } else {
      const folderTable = this.folderTableRef();
      if (!folderTable) {
        console.error('Folder table reference not found');
        this.toast.showNotification('error', 'Error', 'Unable to access results table');
        return;
      }
      selectedResults = folderTable.selection.selected;
    }
    
    console.log('Selected results for sending to CC:', selectedResults);
    
    if (selectedResults.length === 0) {
      this.toast.showNotification('warning', 'No Selection', 'Please select at least one result to send to Course Coordinator');
      return;
    }

    const message = selectedResults.length === 1 
      ? `You're about to send 1 result to the Course Coordinator. This action is irreversible, Are you sure you want to continue?`
      : `You're about to send ${selectedResults.length} results to the Course Coordinator. This action is irreversible, Are you sure you want to continue?`;

    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: message,
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) {
            this.performSendToCC(selectedResults);
          }
        },
      });
  }

  private performSendToCC(selectedResults: IResult[]) {
    this.sendingToCC.set(true);
    
    // Find Course Coordinator from department lecturers
    console.log('Available lecturers:', this.departmentLecturers());
    const courseCoordinator = this.departmentLecturers().find(lecturer => 
      lecturer.role === 'COURSE_COORDINATOR' || lecturer.role === 'course_coordinator'
    );
    console.log('Found Course Coordinator:', courseCoordinator);
    
    if (!courseCoordinator) {
      console.error('Course Coordinator not found in department lecturers');
      this.toast.showNotification('error', 'Error', 'Course Coordinator not found in your department');
      this.sendingToCC.set(false);
      return;
    }
    
    // Validate selected results have valid IDs
    const validResults = selectedResults.filter(result => result._id);
    if (validResults.length === 0) {
      console.error('No valid result IDs found in selected results');
      this.toast.showNotification('error', 'Error', 'Selected results do not have valid IDs');
      this.sendingToCC.set(false);
      return;
    }
    
    // Use the send results API for each result
    console.log('Sending results:', validResults.map(r => ({ id: r._id, course: r.course?.courseTitle })));
    console.log('To recipient:', courseCoordinator._id);
    
    const sendPromises = validResults.map(result => {
      console.log(`Sending result ${result._id} to ${courseCoordinator._id}`);
      return this.resultService.sendResult(result._id!, courseCoordinator._id).toPromise()
        .catch(error => {
          console.error(`Failed to send result ${result._id}:`, error);
          return { status: false, error };
        });
    });

    Promise.all(sendPromises)
      .then((responses) => {
        console.log('Send results responses:', responses);
        const successCount = responses.filter(resp => resp?.status === true).length;
        
        if (successCount === validResults.length) {
          this.toast.showNotification(
            'success', 
            'Success', 
            `Successfully sent ${successCount} result${successCount > 1 ? 's' : ''} to Course Coordinator`
          );
          
          // Move results from lecturer drafts to course coordinator drafts
          this.moveResultsToCCDraft(validResults);
          
          // Trigger notification refresh in toolbar
          this.refreshToolbarNotifications();
          
          // Clear selection and refresh
          const currentUser = this.authService.activeAccount();
          if (currentUser?.role === RoleEnum.LECTURER) {
            const fileTable = this.fileTableRef();
            if (fileTable) {
              fileTable.selection.clear();
            }
            // Remove sent results from current view immediately
            const sentResultIds = validResults.map(result => result._id);
            this.results.update(currentResults => 
              currentResults.filter(result => !sentResultIds.includes(result._id))
            );
          } else {
            const folderTable = this.folderTableRef();
            if (folderTable) {
              folderTable.selection.clear();
              folderTable.folderSelection.clear();
            }
          }
          this.getResults();
        } else {
          const failedCount = validResults.length - successCount;
          this.toast.showNotification(
            successCount > 0 ? 'warning' : 'error', 
            successCount > 0 ? 'Partial Success' : 'Failed', 
            successCount > 0 
              ? `${successCount} of ${validResults.length} results sent successfully. ${failedCount} failed.`
              : `Failed to send ${failedCount} result${failedCount > 1 ? 's' : ''} to Course Coordinator`
          );
          
          // Still move successful sends to CC drafts
          if (successCount > 0) {
            const successfulResults = validResults.filter((_, index) => responses[index]?.status === true);
            this.moveResultsToCCDraft(successfulResults);
            // Remove sent results from current view immediately for lecturers
            const currentUser = this.authService.activeAccount();
            if (currentUser?.role === RoleEnum.LECTURER) {
              const sentResultIds = successfulResults.map(result => result._id);
              this.results.update(currentResults => 
                currentResults.filter(result => !sentResultIds.includes(result._id))
              );
            }
            this.getResults();
          }
        }
      })
      .catch((error) => {
        console.error('Error in Promise.all for sending results to CC:', error);
        this.toast.showNotification(
          'error', 
          'Error', 
          'Failed to send results to Course Coordinator'
        );
      })
      .finally(() => {
        this.sendingToCC.set(false);
      });
  }

  private moveResultsToCCDraft(sentResults: IResult[]) {
    console.log('Moving results to CC draft:', sentResults.map(r => ({ id: r._id, course: r.course?.courseTitle })));
    
    const resultManagementList = JSON.parse(localStorage.getItem('result_management_list') || '[]');
    const resultDraftsList = JSON.parse(localStorage.getItem('result_drafts_list') || '[]');
    
    const sentResultIds = sentResults.map(result => result._id);
    
    // Remove from lecturer drafts
    const updatedDraftsList = resultDraftsList.filter((item: any) => 
      !sentResultIds.includes(item.resultId)
    );
    
    // Remove from management list drafts as well
    const filteredManagementList = resultManagementList.filter((item: any) => 
      !(item.status === ResultStatusEnum.DRAFT && sentResultIds.includes(item.resultId))
    );
    
    // Add sent results to course coordinator drafts with sentToCC flag
    const ccDraftResults = sentResults.map(result => ({
      resultId: result._id,
      courseCode: result.course?.courseCode || (result as any).courseCode,
      courseTitle: result.course?.courseTitle || (result as any).courseTitle,
      session: result.session,
      level: result.level,
      semester: result.semester,
      department: result.department?.name || 'Unknown Department',
      faculty: result.faculty || 'Unknown Faculty',
      status: ResultStatusEnum.DRAFT,
      timestamp: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      sentToCC: true,
      sentToCCAt: new Date().toISOString(),
      lecturer: result.lecturer,
      uploadedBy: result.uploadedBy,
      totalStudents: result.studentCount || 0,
      studentsWithGrades: result.studentsWithGrades || 0,
      completionPercentage: result.completionPercentage || 0
    }));
    
    // Update localStorage
    const updatedManagementList = [...filteredManagementList, ...ccDraftResults];
    
    localStorage.setItem('result_management_list', JSON.stringify(updatedManagementList));
    localStorage.setItem('result_drafts_list', JSON.stringify(updatedDraftsList));
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
    const currentUser = this.authService.activeAccount();
    
    // For LECTURERS: Navigate to result-upload for editing
    if (currentUser?.role === RoleEnum.LECTURER) {
      this.router.navigate(['/my-result/upload-result'], {
        queryParams: { resultId: course._id },
      });
      return;
    }
    
    // For COURSE COORDINATORS: Navigate to standalone course coordinator results view
    if (currentUser?.role === RoleEnum.COURSE_COORDINATOR) {
      this.router.navigate(['/my-result/course-coordinator-results'], {
        queryParams: { resultId: course._id },
      });
      return;
    }
    
    // For other roles (HOD, DEAN, etc.): Navigate to verify-result
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

    // Generate course code based on course title
    if (courseTitle.toLowerCase().includes('real analysis')) {
      return 'MATH301';
    }
    if (courseTitle.toLowerCase().includes('analysis')) {
      return 'MATH201';
    }
    if (courseTitle.toLowerCase().includes('calculus')) {
      return 'MATH101';
    }
    if (courseTitle.toLowerCase().includes('physics')) {
      return 'PHY201';
    }
    if (courseTitle.toLowerCase().includes('chemistry')) {
      return 'CHM101';
    }
    if (courseTitle.toLowerCase().includes('computer')) {
      return 'CSC201';
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

  private deduplicateResults(results: IResult[]): IResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result._id || `${result.course?.courseCode}-${result.session}-${result.level}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private loadNotifications() {
    this.notificationService.getNotifications().subscribe({
      next: (resp) => {
        if (resp.status) {
          console.log('Notifications loaded:', resp.data);
        }
      },
      error: (error) => {
        console.warn('Failed to load notifications:', error);
      }
    });
  }

  private refreshToolbarNotifications() {
    // Dispatch custom event to refresh notifications
    const event = new CustomEvent('refreshNotifications');
    document.dispatchEvent(event);
    
    // Also trigger a manual refresh after a short delay
    setTimeout(() => {
      this.loadNotifications();
    }, 1000);
  }


}