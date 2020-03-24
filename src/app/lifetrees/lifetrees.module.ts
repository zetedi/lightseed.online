import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SharedModule } from '../shared/shared.module';

import { LifetreesComponent } from './lifetrees.component';
import { LifetreesListComponent } from './lifetrees-list/lifetrees-list.component';
import { LifetreesFilterComponent } from './lifetrees-list/lifetrees-filter/lifetrees-filter.component';

import { LifetreesRoutingModule } from './lifetrees-routing.module';
import { LifetreeDetailsComponent } from './lifetree-details/lifetree-details.component';

@NgModule({
    imports: [CommonModule, SharedModule, FormsModule, LifetreesRoutingModule],
    declarations: [LifetreesComponent, LifetreesListComponent, LifetreesFilterComponent, LifetreeDetailsComponent],
    exports: [LifetreesComponent]
})
export class LifetreesModule { }