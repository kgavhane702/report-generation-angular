import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { AppComponent } from './app.component';
import { EditorModule } from './features/editor/editor.module';
import {
  documentFeatureKey,
  documentReducer,
} from './store/document/document.reducer';
import { IconPreloaderService } from './shared/components/icon/icon-preloader.service';

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
    HttpClientModule,
    StoreModule.forRoot({
      [documentFeatureKey]: documentReducer,
    }),
    EffectsModule.forRoot([]),
    EditorModule,
  ],
  providers: [
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
