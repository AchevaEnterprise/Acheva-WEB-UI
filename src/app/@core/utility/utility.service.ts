import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilityService {
  formatCount(count: number) {
    return count > 10 ? '10+' : count.toString();
  }
}
