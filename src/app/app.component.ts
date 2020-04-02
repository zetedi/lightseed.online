import { Component, OnInit } from '@angular/core';



@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})


export class AppComponent implements OnInit {

  constructor() { }

  title = 'core';

  ngOnInit() {

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



  }
}
