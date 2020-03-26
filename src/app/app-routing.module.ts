import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrdersComponent } from './orders/orders.component';
import { MapComponent } from './map/map.component';
import { LifetreeDetailsComponent } from './lifetrees/lifetree-details/lifetree-details.component';


const routes: Routes = [
  { path: 'login', pathMatch: 'full', redirectTo: '/login'},
  { path: 'lifetrees', pathMatch: 'full', redirectTo: '/lifetrees'},
  { path: 'lifetree-details/:id', component: LifetreeDetailsComponent },
  { path: 'map', component: MapComponent },
  { path: 'orders/:id', component: OrdersComponent },
  { path: '', pathMatch: 'full', redirectTo: '/login'},
  { path: '**', pathMatch: 'full', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
