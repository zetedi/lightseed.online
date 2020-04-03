import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from './_services';
import { User } from './_models';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})


export class AppComponent implements OnInit {

  currentUser: User;

    constructor(
        private router: Router,
        private authenticationService: AuthenticationService
    ) {
        this.authenticationService.currentUser.subscribe(x => this.currentUser = x);
    }

    logout() {
        this.authenticationService.logout();
        this.router.navigate(['/login']);
    }

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
