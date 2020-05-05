import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SharedModule } from '../shared/shared.module';
import { Scout7Component } from './scout7.component';
// import { HomeRoutingModule } from './home-routing.module';

@NgModule({
    imports: [CommonModule, SharedModule, FormsModule],
    declarations: [Scout7Component],
    exports: [Scout7Component]
})
export class Scout7Module { }