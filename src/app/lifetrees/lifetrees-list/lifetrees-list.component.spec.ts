import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LifetreesListComponent } from './lifetrees-list.component';

describe('LifetreesListComponent', () => {
  let component: LifetreesListComponent;
  let fixture: ComponentFixture<LifetreesListComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LifetreesListComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LifetreesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
