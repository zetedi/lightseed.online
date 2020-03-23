import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrdersComponent } from './orders/orders.component';
import { DetailsComponent } from './details/details.component';


const routes: Routes = [
  { path: 'login', pathMatch: 'full', redirectTo: '/login'},
  { path: 'orders/:id', component: OrdersComponent },
  { path: 'details', component: DetailsComponent },
  { path: '', pathMatch: 'full', redirectTo: '/lifetrees'},
  { path: '**', pathMatch: 'full', redirectTo: '/lifetrees' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
