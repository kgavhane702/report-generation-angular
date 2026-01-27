import { Injectable, inject } from '@angular/core';
import { ToastrService, IndividualConfig } from 'ngx-toastr';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly toastr = inject(ToastrService);

  success(message: string, title = 'Success', options?: Partial<IndividualConfig>): void {
    this.toastr.success(message, title, options);
  }

  info(message: string, title = 'Info', options?: Partial<IndividualConfig>): void {
    this.toastr.info(message, title, options);
  }

  warning(message: string, title = 'Warning', options?: Partial<IndividualConfig>): void {
    this.toastr.warning(message, title, options);
  }

  error(message: string, title = 'Error', options?: Partial<IndividualConfig>): void {
    this.toastr.error(message, title, { timeOut: 6000, extendedTimeOut: 2000, ...options });
  }
}


