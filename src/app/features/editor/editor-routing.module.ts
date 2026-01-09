import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { EditorShellComponent } from './editor-shell/editor-shell.component';

const routes: Routes = [
  {
    path: '',
    component: EditorShellComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EditorRoutingModule {}


