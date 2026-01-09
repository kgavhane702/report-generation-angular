import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

/**
 * App routing
 *
 * NOTE: We introduce routing primarily to enable lazy-loading and code-splitting.
 * The editor feature is heavy (CKEditor, charts, etc.) and should not be in the initial bundle.
 */
const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/editor/editor.module').then((m) => m.EditorModule),
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}


