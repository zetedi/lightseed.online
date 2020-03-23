import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LifetreesFilterComponent } from './lifetrees-filter.component';

describe('LifetreesFilterComponent', () => {
  let component: LifetreesFilterComponent;
  let fixture: ComponentFixture<LifetreesFilterComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LifetreesFilterComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LifetreesFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
