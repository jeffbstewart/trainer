import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Welcome to Trainer</h1>
    <p>Your workout planning and tracking dashboard will live here.</p>
  `,
  styles: `
    h1 { margin: 0 0 0.5rem; }
    p { opacity: 0.6; }
  `,
})
export class HomeComponent {}
