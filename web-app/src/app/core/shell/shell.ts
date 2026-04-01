import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule],
  template: `
    <mat-toolbar class="toolbar">
      <span class="title">Trainer</span>
      <span class="spacer"></span>
      <button mat-icon-button [matMenuTriggerFor]="profileMenu" aria-label="Profile menu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #profileMenu="matMenu">
        <button mat-menu-item (click)="onLogout()">
          <mat-icon>logout</mat-icon>
          <span>Sign Out</span>
        </button>
      </mat-menu>
    </mat-toolbar>
    <div class="content">
      <router-outlet />
    </div>
  `,
  styles: `
    .toolbar { position: sticky; top: 0; z-index: 1; }
    .title { font-size: 1.125rem; font-weight: 700; }
    .spacer { flex: 1; }
    .content { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
  `,
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async onLogout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
