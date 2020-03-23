import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LifetreesComponent } from './lifetrees.component';


const routes: Routes = [
    { path: 'lifetrees', component: LifetreesComponent }
];

@NgModule({
    imports: [ RouterModule.forChild(routes) ], 
    exports: [ RouterModule ]
})
export class LifetreesRoutingModule {

}