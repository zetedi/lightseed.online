import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '../shared/shared.module';
import { RegisterComponent } from './register.component';
// import { HomeRoutingModule } from './home-routing.module';

@NgModule({
    imports: [CommonModule, SharedModule, FormsModule, ReactiveFormsModule],
    declarations: [RegisterComponent],
    exports: [RegisterComponent]
})
export class RegisterModule { }