import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SharedModule } from '../shared/shared.module';
import { PersonComponent } from './person.component';
// import { HomeRoutingModule } from './home-routing.module';

@NgModule({
    imports: [CommonModule, SharedModule, FormsModule],
    declarations: [PersonComponent],
    exports: [PersonComponent]
})
export class PersonModule { }