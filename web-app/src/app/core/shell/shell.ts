import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatSidenavModule, MatListModule, MatIconModule, MatButtonModule, MatMenuModule],
  template: `
    @if (impersonating()) {
      <div class="impersonation-bar">
        <mat-icon>supervisor_account</mat-icon>
        Impersonating {{ impersonatingUser() }}
        <button mat-flat-button (click)="endImpersonation()">End Impersonation</button>
      </div>
    }
    <mat-sidenav-container class="shell-container">
      <mat-sidenav #drawer mode="over" class="sidenav">
        <mat-nav-list>
          <a mat-list-item routerLink="/" routerLinkActive="active-link"
             [routerLinkActiveOptions]="{ exact: true }" (click)="drawer.close()">
            <mat-icon matListItemIcon>home</mat-icon>
            <span matListItemTitle>Home</span>
          </a>

          @if (accessLevel() >= 2) {
            <div class="nav-section">TRAINING</div>
            <a mat-list-item routerLink="/targets" routerLinkActive="active-link" (click)="drawer.close()">
              <mat-icon matListItemIcon>fitness_center</mat-icon>
              <span matListItemTitle>Targets</span>
            </a>
            <a mat-list-item routerLink="/exercises" routerLinkActive="active-link" (click)="drawer.close()">
              <mat-icon matListItemIcon>sports_gymnastics</mat-icon>
              <span matListItemTitle>Exercises</span>
            </a>
            <a mat-list-item routerLink="/equipment" routerLinkActive="active-link" (click)="drawer.close()">
              <mat-icon matListItemIcon>inventory_2</mat-icon>
              <span matListItemTitle>Equipment</span>
            </a>

            <div class="nav-section">MANAGE</div>
            <a mat-list-item routerLink="/users" routerLinkActive="active-link" (click)="drawer.close()">
              <mat-icon matListItemIcon>people</mat-icon>
              <span matListItemTitle>Users</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="toolbar" color="primary">
          <button mat-icon-button (click)="drawer.toggle()" aria-label="Toggle navigation">
            <mat-icon>menu</mat-icon>
          </button>
          <a routerLink="/" class="title">Trainer</a>
          <span class="spacer"></span>
          <span class="username">{{ username() }}</span>
          <button mat-icon-button [matMenuTriggerFor]="profileMenu" aria-label="Profile menu">
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #profileMenu="matMenu">
            <a mat-menu-item routerLink="/profile">
              <mat-icon>person</mat-icon>
              <span>Profile &amp; Settings</span>
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
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .impersonation-bar {
      background: #f44336; color: white; padding: 8px 16px;
      display: flex; align-items: center; gap: 0.75rem; font-size: 0.875rem; font-weight: 500;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      button { margin-left: auto; }
    }
    .shell-container { height: 100vh; }
    .sidenav { width: 260px; }
    .nav-section {
      font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.05em;
      opacity: 0.4; padding: 12px 16px 4px;
    }
    .active-link { background: rgba(0,0,0,0.08); }
    .toolbar {
      position: sticky; top: 0; z-index: 1;
      background: var(--mat-sys-primary, #005cbb);
      color: var(--mat-sys-on-primary, #ffffff);
    }
    .title { font-size: 1.125rem; font-weight: 700; text-decoration: none; color: inherit; margin-left: 0.5rem; }
    .spacer { flex: 1; }
    .username { font-size: 0.8125rem; opacity: 0.7; margin-right: 0.25rem; }
    .content { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
  `,
})
export class ShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly username = signal('');
  readonly accessLevel = signal(0);
  readonly impersonating = signal(false);
  readonly impersonatingUser = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const p = await firstValueFrom(this.http.get<{
        access_level: number; is_impersonating: boolean;
        username: string; real_admin_username?: string;
      }>('/api/v1/profile'));
      this.username.set(p.username);
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
