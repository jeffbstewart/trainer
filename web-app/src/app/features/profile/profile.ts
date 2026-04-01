import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth.service';

interface Profile {
  id: number; username: string; role: string; access_level: number;
  is_impersonating: boolean; real_admin_username?: string;
}

interface Session {
  id: number; user_agent: string | null; created_at: string | null;
  expires_at: string | null; last_used_at: string | null;
}

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2>Profile</h2>

    @if (profile(); as p) {
      @if (p.is_impersonating) {
        <div class="impersonation-banner">
          Impersonating {{ p.username }} (admin: {{ p.real_admin_username }})
          <button mat-stroked-button (click)="endImpersonation()">End Impersonation</button>
        </div>
      }

      <div class="info-section">
        <div class="info-row"><span class="label">Username</span><span>{{ p.username }}</span></div>
        <div class="info-row"><span class="label">Role</span><span>{{ p.role }}</span></div>
      </div>

      <h3>Change Password</h3>
      <div class="password-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Current Password</mat-label>
          <input matInput type="password" [value]="pwCurrent()" (input)="pwCurrent.set($any($event.target).value)" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>New Password</mat-label>
          <input matInput type="password" [value]="pwNew()" (input)="pwNew.set($any($event.target).value)" />
          <mat-hint>At least 8 characters</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Confirm Password</mat-label>
          <input matInput type="password" [value]="pwConfirm()" (input)="pwConfirm.set($any($event.target).value)" />
        </mat-form-field>
        @if (pwError()) { <p class="error-text">{{ pwError() }}</p> }
        @if (pwSuccess()) { <p class="success-text">Password changed.</p> }
        <button mat-flat-button color="primary" [disabled]="!pwValid()" (click)="changePassword()">
          Change Password
        </button>
      </div>

      <h3>Active Sessions</h3>
      <button mat-stroked-button color="warn" (click)="revokeAll()">Revoke All Sessions</button>
      <div class="session-list">
        @for (s of sessions(); track s.id) {
          <div class="session-row">
            <span class="session-ua">{{ s.user_agent ?? 'Unknown' }}</span>
            <span class="session-meta">Last used: {{ s.last_used_at ?? '—' }}</span>
            <button mat-stroked-button class="revoke-btn" (click)="revokeSession(s.id)">Revoke</button>
          </div>
        }
      </div>
    }
  `,
  styles: `
    h2 { margin: 0 0 1rem; }
    h3 { margin: 1.5rem 0 0.5rem; }
    .impersonation-banner {
      background: rgba(244,67,54,0.15); color: #f44336; padding: 12px 16px;
      border-radius: 8px; margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;
      button { margin-left: auto; }
    }
    .info-section { margin-bottom: 1rem; }
    .info-row { display: flex; gap: 1rem; padding: 4px 0; }
    .label { font-weight: 600; min-width: 100px; opacity: 0.6; }
    .full-width { width: 100%; }
    .password-form { max-width: 400px; }
    .error-text { color: #f44336; font-size: 0.8125rem; }
    .success-text { color: #4caf50; font-size: 0.8125rem; }
    .session-list { margin-top: 0.5rem; }
    .session-row {
      display: flex; align-items: center; gap: 0.75rem; padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .session-ua { flex: 1; font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .session-meta { font-size: 0.75rem; opacity: 0.4; flex-shrink: 0; }
    .revoke-btn { font-size: 0.75rem; }
  `,
})
export class ProfileComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly profile = signal<Profile | null>(null);
  readonly sessions = signal<Session[]>([]);
  readonly pwCurrent = signal('');
  readonly pwNew = signal('');
  readonly pwConfirm = signal('');
  readonly pwError = signal('');
  readonly pwSuccess = signal(false);

  pwValid(): boolean {
    return this.pwCurrent().length > 0 && this.pwNew().length >= 8 && this.pwNew() === this.pwConfirm();
  }

  async ngOnInit(): Promise<void> {
    try {
      const p = await firstValueFrom(this.http.get<Profile>('/api/v1/profile'));
      this.profile.set(p);
      const data = await firstValueFrom(this.http.get<{ sessions: Session[] }>(`/api/v1/users/${p.id}/sessions`));
      this.sessions.set(data.sessions);
    } catch { /* ignore */ }
  }

  async changePassword(): Promise<void> {
    this.pwError.set('');
    this.pwSuccess.set(false);
    try {
      const r = await firstValueFrom(this.http.post<{ ok: boolean; error?: string }>(
        '/api/v1/auth/change-password', { current_password: this.pwCurrent(), new_password: this.pwNew() }));
      if (r.ok) {
        this.pwSuccess.set(true);
        this.pwCurrent.set(''); this.pwNew.set(''); this.pwConfirm.set('');
      } else {
        this.pwError.set(r.error ?? 'Failed');
      }
    } catch { this.pwError.set('Request failed'); }
  }

  async revokeSession(id: number): Promise<void> {
    const p = this.profile();
    if (!p) return;
    await firstValueFrom(this.http.delete(`/api/v1/users/${p.id}/sessions/${id}`));
    this.sessions.update(s => s.filter(x => x.id !== id));
  }

  async revokeAll(): Promise<void> {
    const p = this.profile();
    if (!p) return;
    if (!confirm('This will sign you out of all sessions, including this one. Continue?')) return;
    await firstValueFrom(this.http.post(`/api/v1/users/${p.id}/sessions/revoke-all`, {}));
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  async endImpersonation(): Promise<void> {
    await firstValueFrom(this.http.post('/api/v1/auth/end-impersonate', {}));
    window.location.reload();
  }
}
