import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrdersComponent } from './orders/orders.component';
import { MapComponent } from './map/map.component';
import { LifetreeDetailsComponent } from './lifetrees/lifetree-details/lifetree-details.component';


const routes: Routes = [
  { path: 'login', pathMatch: 'full', redirectTo: '/login'},
  { path: 'orders/:id', component: OrdersComponent },
  { path: 'map', component: MapComponent },
  { path: 'lifetree-details', component: LifetreeDetailsComponent },
  { path: '', pathMatch: 'full', redirectTo: '/lifetrees'},
  { path: '**', pathMatch: 'full', redirectTo: '/lifetrees' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
