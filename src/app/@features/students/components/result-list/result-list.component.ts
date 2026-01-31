import { NgClass } from '@angular/common';
import {
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { LevelsEnum } from '../../../../@core/models/school.model';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';
import { ResultsService } from '../../../result-management/services/results.service';
import { IResultEntry } from '../../models/student.model';

export interface IResultSessions {
  level: LevelsEnum;
  session: string;
  active: boolean;
  payed: boolean;
  entries: IResultEntry[];
}

@Component({
  selector: 'app-result-list',
  imports: [SvgComponent, NgClass, LoaderComponent],
  templateUrl: './result-list.component.html',
  styleUrl: './result-list.component.scss',
})
export class ResultListComponent implements OnInit {
  private readonly resultService = inject(ResultsService);
  viewSessionResultEvent = output<IResultSessions>();

  studentId = input<string>();
  loading = signal(false);

  sessionsList = signal<IResultSessions[]>([
    {
      level: LevelsEnum.YEAR_ONE,
      session: '',
      active: false,
      payed: true,
      entries: [],
    },
    {
      level: LevelsEnum.YEAR_TWO,
      session: '',
      active: false,
      payed: true,
      entries: [],
    },
    {
      level: LevelsEnum.YEAR_THREE,
      session: '',
      active: false,
      payed: true,
      entries: [],
    },
    {
      level: LevelsEnum.YEAR_FOUR,
      session: '',
      active: false,
      payed: true,
      entries: [],
    },
    {
      level: LevelsEnum.YEAR_FIVE,
      session: '',
      active: false,
      payed: true,
      entries: [],
    },
    {
      level: LevelsEnum.YEAR_SIX,
      session: '',
      active: false,
      payed: true,
      entries: [],
    },
    {
      level: LevelsEnum.REFERENCE,
      session: '',
      active: false,
      payed: true,
      entries: [],
    },
  ]);

  viewSessionResult(session: IResultSessions) {
    if (!session.active) return;
    this.viewSessionResultEvent.emit(session);
  }

  ngOnInit(): void {
    this.getResultBySessions();
  }

  getResultBySessions() {
    this.loading.set(true);
    this.resultService
      .getStudentResultsBySessions(this.studentId()!)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.sessionsList.update((sessionsList: IResultSessions[]) => {
            for (const session of sessionsList) {
              for (const sesionResp of resp.data) {
                if (sesionResp.level === session.level) {
                  session.session = sesionResp.session;
                  session.entries = sesionResp.entries;
                  session.active = true;
                }
              }
            }
            return sessionsList;
          });
        },
      });
  }
}
