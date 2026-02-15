import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor() {
    // Reset one-time chunk reload guard on successful app load.
    try {
      sessionStorage.removeItem('rg_chunk_reload_once');
    } catch {
      // no-op
    }
  }
}
