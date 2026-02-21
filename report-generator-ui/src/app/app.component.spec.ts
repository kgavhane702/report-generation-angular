import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let removeItemSpy: jasmine.Spy;

  beforeEach(() => TestBed.configureTestingModule({
    declarations: [AppComponent],
    imports: [RouterTestingModule]
  }));

  beforeEach(() => {
    removeItemSpy = spyOn(sessionStorage, 'removeItem');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should clear chunk reload guard on init', () => {
    TestBed.createComponent(AppComponent);
    expect(removeItemSpy).toHaveBeenCalledWith('rg_chunk_reload_once');
  });
});
