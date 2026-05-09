import { TestBed } from '@angular/core/testing';

import { Perizie } from './perizie';

describe('Perizie', () => {
  let service: Perizie;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Perizie);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
