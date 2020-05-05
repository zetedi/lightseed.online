import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { User } from '../_models';
import { UserService, AuthenticationService } from '../_services';

@Component({
    selector: 'app-scout7',
    templateUrl: './scout7.component.html',
    styleUrls: ['./scout7.component.css']
})
export class Scout7Component implements OnInit {

    ngOnInit() {

    }

}