import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LifetreesModule } from './lifetrees/lifetrees.module';
import { LoginModule } from './login/login.module';
import { SharedModule } from './shared/shared.module';
import { CoreModule } from './core/core.module';
import { OrdersModule } from './orders/orders.module';
import { MapComponent } from './map/map.component';

@NgModule({
  imports: [
    BrowserModule,
    CoreModule,
    AppRoutingModule,
    LifetreesModule,
    LoginModule,    
    OrdersModule,
    SharedModule],
  declarations: [
    AppComponent,
    MapComponent
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
