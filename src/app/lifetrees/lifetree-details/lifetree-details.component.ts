import { Component, OnInit, Input } from '@angular/core';
import { ILifetree } from 'src/app/shared/interfaces';
import { SorterService } from 'src/app/core/sorter.service';

@Component({
  selector: 'app-lifetree-details',
  templateUrl: './lifetree-details.component.html',
  styleUrls: ['./lifetree-details.component.css']
})
export class LifetreeDetailsComponent implements OnInit {

  constructor(private sorterService: SorterService) { }

  ngOnInit(): void {
  }

}
