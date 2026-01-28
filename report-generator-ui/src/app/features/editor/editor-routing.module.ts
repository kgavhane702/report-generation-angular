import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { EditorShellComponent } from './editor-shell/editor-shell.component';
import { ExportShellComponent } from './export-shell/export-shell.component';

const routes: Routes = [
  {
    path: 'export',
    component: ExportShellComponent,
  },
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


