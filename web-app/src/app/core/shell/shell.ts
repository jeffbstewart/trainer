import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule],
  template: `
    @if (impersonating()) {
      <div class="impersonation-bar">
        Impersonating {{ impersonatingUser() }}
        <button mat-stroked-button (click)="endImpersonation()">End Impersonation</button>
      </div>
    }
    <mat-toolbar class="toolbar">
      <a routerLink="/" class="title">Trainer</a>
      @if (accessLevel() >= 2) {
        <a mat-button routerLink="/users">Users</a>
      }
      <span class="spacer"></span>
      <button mat-icon-button [matMenuTriggerFor]="profileMenu" aria-label="Profile menu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #profileMenu="matMenu">
        <a mat-menu-item routerLink="/profile">
          <mat-icon>person</mat-icon>
          <span>Profile</span>
        </a>
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
    .impersonation-bar {
      background: #f44336; color: white; padding: 6px 16px;
      display: flex; align-items: center; gap: 1rem; font-size: 0.875rem; font-weight: 500;
      button { margin-left: auto; color: white; border-color: rgba(255,255,255,0.5); }
    }
    .toolbar { position: sticky; top: 0; z-index: 1; }
    .title { font-size: 1.125rem; font-weight: 700; text-decoration: none; color: inherit; }
    .spacer { flex: 1; }
    .content { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
  `,
})
export class ShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly accessLevel = signal(0);
  readonly impersonating = signal(false);
  readonly impersonatingUser = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const p = await firstValueFrom(this.http.get<{
        access_level: number; is_impersonating: boolean;
        username: string; real_admin_username?: string;
      }>('/api/v1/profile'));
      this.accessLevel.set(p.access_level);
      this.impersonating.set(p.is_impersonating);
      if (p.is_impersonating) this.impersonatingUser.set(p.username);
    } catch { /* ignore */ }
  }

  async onLogout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  async endImpersonation(): Promise<void> {
    await firstValueFrom(this.http.post('/api/v1/auth/end-impersonate', {}));
    window.location.href = '/app/';
  }
}
