import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'facultyInitial',
})
export class FacultyInitialPipe implements PipeTransform {
  transform(value: unknown): string {
    let initial = '';
    if (typeof value === 'string') {
      const names = value.split(' ');
      for (const name of names) {
        if (name.length > 0) {
          initial += name.charAt(0).toUpperCase();
        }
      }
    }

    return initial;
  }
}
