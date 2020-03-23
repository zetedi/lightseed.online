import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs/Observable';
import { map, catchError } from 'rxjs/operators';

import { ILifetree, IOrder } from '../../app/shared/interfaces';

@Injectable()
export class DataService {

    baseUrl: string = 'assets/';

    constructor(private http: HttpClient) { }

    getLifetrees(): Observable<ILifetree[]> {
        return this.http.get<ILifetree[]>(this.baseUrl + 'lifetrees.json')
            .pipe(
                catchError(this.handleError)
            );
    }

    getLifetree(id: number): Observable<ILifetree> {
        return this.http.get<ILifetree[]>(this.baseUrl + 'lifetrees.json')
            .pipe(
                map(lifetrees => {
                    let lifetree = lifetrees.filter((lifetree: ILifetree) => lifetree.id === id);
                    return (lifetree && lifetree.length) ? lifetree[0] : null;
                }),
                catchError(this.handleError)
            )
    }

    getOrders(id: number): Observable<IOrder[]> {
        return this.http.get<IOrder[]>(this.baseUrl + 'orders.json')
            .pipe(
                map(orders => {
                    let lifetreeOrders = orders.filter((order: IOrder) => order.customerId === id);
                    return lifetreeOrders;
                }),
                catchError(this.handleError)
            );
    }


    private handleError(error: any) {
        console.error('server error:', error);
        if (error.error instanceof Error) {
            const errMessage = error.error.message;
            return Observable.throw(errMessage);
            // Use the following instead if using lite-server
            // return Observable.throw(err.text() || 'backend server error');
        }
        return Observable.throw(error || 'Node.js server error');
    }

}