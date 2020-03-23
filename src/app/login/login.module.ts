import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SharedModule } from '../shared/shared.module';
import { LoginComponent } from './login.component';
import { LoginRoutingModule } from './login-routing.module';

@NgModule({
    imports: [CommonModule, SharedModule, FormsModule, LoginRoutingModule],
    declarations: [LoginComponent],
    exports: [LoginComponent]
})
export class LoginModule { }