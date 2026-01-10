import { Pipe, PipeTransform } from '@angular/core';
import { IResult } from '../../@features/result-management/models/results.model';

@Pipe({
  name: 'hasRejected',
})
export class HasRejectedPipe implements PipeTransform {
  transform(value: IResult[]): boolean {
    return value.some((result) => result.isApproved === false);
  }
}
