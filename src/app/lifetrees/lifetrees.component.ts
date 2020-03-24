import { Component, OnInit } from '@angular/core';
import { ILifetree } from '../shared/interfaces';
import { DataService } from '../core/data.service';
@Component({
  selector: 'app-lifetrees',
  templateUrl: './lifetrees.component.html',
  styleUrls: ['./lifetrees.component.css']
})
export class LifetreesComponent implements OnInit {

  title: string;
  lifetrees: ILifetree[];

  constructor(private dataService: DataService) { }

  ngOnInit() {

    this.title = 'lifetrees';
    this.dataService.getLifetrees()
    .subscribe((lifetrees: ILifetree[]) => this.lifetrees = lifetrees);

  }

}
