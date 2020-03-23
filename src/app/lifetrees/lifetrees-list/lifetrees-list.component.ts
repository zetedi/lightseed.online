import { Component, OnInit, Input } from '@angular/core';
import { ILifetree } from 'src/app/shared/interfaces';
import { SorterService} from 'src/app/core/sorter.service';

@Component({
  selector: 'app-lifetrees-list',
  templateUrl: './lifetrees-list.component.html',
  styleUrls: ['./lifetrees-list.component.css']
})
export class LifetreesListComponent implements OnInit {

  constructor(private sorterService: SorterService) {}

  private _lifetrees: ILifetree[] = [];

  @Input() get lifetrees(): ILifetree[] {
    return this._lifetrees;
  }

  set lifetrees(value: ILifetree[]) {
    if (value) {
      this.filteredLifetrees = this._lifetrees = value;
      this.calculateOrders();
    }
  }

  filteredLifetrees: ILifetree[] = [];
  lifetreesOrderTotal: number;
  currencyCode: string = 'USD';

  ngOnInit(): void {
  }

  calculateOrders() {
    this.lifetreesOrderTotal = 0;
    this.filteredLifetrees.forEach((lifetree: ILifetree) => {
      this.lifetreesOrderTotal += lifetree.orderTotal;
    });
  }

  filter(data: string) {
    if (data) {
        this.filteredLifetrees = this.lifetrees.filter((cust: ILifetree) => {
            return cust.name.toLowerCase().indexOf(data.toLowerCase()) > -1 ||
                   cust.city.toLowerCase().indexOf(data.toLowerCase()) > -1 ||
                   cust.orderTotal.toString().indexOf(data) > -1;
        });
      } else {
        this.filteredLifetrees = this.lifetrees;
      }
      this.calculateOrders();
}

  sort(prop: string) {
    this.sorterService.sort(this.filteredLifetrees, prop);
  }

}
