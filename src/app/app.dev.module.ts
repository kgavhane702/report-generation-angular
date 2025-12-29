import { NgModule } from '@angular/core';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

import { AppComponent } from './app.component';
import { AppModule } from './app.module';

/**
 * AppDevModule
 *
 * Development-only root module that enables NgRx DevTools.
 * Keep `AppModule` (production) free of dev-only modules to avoid AOT metadata issues and
 * reduce prod bundle size.
 */
@NgModule({
  imports: [
    // Import the main app module so AppComponent is declared exactly once.
    AppModule,
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      autoPause: true,
    }),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppDevModule {}


