import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';


if (environment.production) {
  platformBrowserDynamic()
    .bootstrapModule(AppModule)
    // eslint-disable-next-line no-console
    .catch((err) => console.error(err));
} else {
  // Lazy-load dev-only module so prod builds don't pull it in.
  import('./app/app.dev.module')
    .then(({ AppDevModule }) => platformBrowserDynamic().bootstrapModule(AppDevModule))
    // eslint-disable-next-line no-console
    .catch((err) => console.error(err));
}
