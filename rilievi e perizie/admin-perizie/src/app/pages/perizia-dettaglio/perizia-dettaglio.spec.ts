import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PeriziaDettaglio } from './perizia-dettaglio';

describe('PeriziaDettaglio', () => {
  let component: PeriziaDettaglio;
  let fixture: ComponentFixture<PeriziaDettaglio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PeriziaDettaglio]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PeriziaDettaglio);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
