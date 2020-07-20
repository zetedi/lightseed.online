import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrdersComponent } from './orders/orders.component';
import { MapComponent } from './map/map.component';
import { LifetreeDetailsComponent } from './lifetrees/lifetree-details/lifetree-details.component';
import { HomeComponent } from './home/home.component';
import { PersonComponent } from './person/person.component';
import { Scout7Component } from './scout7/scout7.component';
import { RegisterComponent } from './register/register.component';
import { AuthGuard } from './_helpers/auth.guard';


const routes: Routes = [
  { path: '', component: MapComponent},
  { path: 'register', component: RegisterComponent },
  { path: 'login', pathMatch: 'full', redirectTo: '/login' },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'person', component: PersonComponent, canActivate: [AuthGuard] },
  { path: 'scout7', component: Scout7Component },
  { path: 'lifetrees', pathMatch: 'full', redirectTo: '/lifetrees' },
  { path: 'lifetree-details/:id', component: LifetreeDetailsComponent },
  { path: 'map', component: MapComponent },
  { path: 'orders/:id', component: OrdersComponent },
  { path: '**', pathMatch: 'full', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
