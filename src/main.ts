import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));

// let width = document.getElementById('width');
// var onresize = function() {
//    width.innerText = document.body.clientWidth;
//    width.classList.add('display-width');
//    setTimeout(() => {
//        width.classList.remove('display-width');
//    }, 2000)
// }
// window.addEventListener("resize", onresize);

const get = element => document.getElementById(element);

let open = get("menu-btn");
let nav = get("nav");
let exit = get("exit-btn");

open.addEventListener('click', () => {
    nav.classList.add('open-nav');
})

exit.addEventListener('click', () => {
    nav.classList.remove('open-nav');
})
