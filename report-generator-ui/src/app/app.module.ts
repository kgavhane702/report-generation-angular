import { APP_INITIALIZER, ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { ToastrModule } from 'ngx-toastr';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import {
  documentFeatureKey,
  documentReducer,
} from './store/document/document.reducer';
import { IconPreloaderService } from './shared/components/icon/icon-preloader.service';
import { ChunkLoadErrorHandlerService } from './core/services/chunk-load-error-handler.service';

/**
 * Factory for APP_INITIALIZER that preloads toolbar icons.
 * Icons are loaded in parallel; app doesn't wait for them but they'll be cached fast.
 */
function initializeIcons(iconPreloader: IconPreloaderService): () => Promise<void> {
  return () => {
    // Start preloading but don't block app startup
    iconPreloader.preloadIcons();
    return Promise.resolve();
  };
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    ToastrModule.forRoot({
      closeButton: true,
      newestOnTop: true,
      preventDuplicates: true,
      positionClass: 'toast-bottom-right',
      timeOut: 3500,
      extendedTimeOut: 1500,
    }),
    StoreModule.forRoot({
      [documentFeatureKey]: documentReducer,
    }),
    EffectsModule.forRoot([]),
  ],
  providers: [
    {
      provide: ErrorHandler,
      useClass: ChunkLoadErrorHandlerService,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeIcons,
      deps: [IconPreloaderService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
