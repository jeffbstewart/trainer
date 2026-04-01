import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

interface UserDetail {
  id: number; username: string; role: string; access_level: number;
  locked: boolean; must_change_password: boolean; trainer_id: number | null;
  created_at: string | null;
}

interface Session {
  id: number; user_agent: string | null; last_used_at: string | null; expires_at: string | null;
}

interface ProfileInfo {
  access_level: number; is_impersonating: boolean;
}

@Component({
  selector: 'app-user-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatCardModule],
  template: `
    @if (user(); as u) {
      <h2>{{ u.username }}</h2>
      <div class="info-section">
        <div class="info-row"><span class="label">Role</span><span>{{ u.role }}</span></div>
        <div class="info-row"><span class="label">Status</span>
          <span>
            @if (u.locked) { <span class="badge locked">Locked</span> }
            @if (u.must_change_password) { <span class="badge pw">Password Change Required</span> }
            @if (!u.locked && !u.must_change_password) { Active }
          </span>
        </div>
        @if (u.created_at) {
          <div class="info-row"><span class="label">Created</span><span>{{ u.created_at }}</span></div>
        }
      </div>

      <div class="action-row">
        <button mat-flat-button color="primary" (click)="resetPassword()">
          <mat-icon>lock_reset</mat-icon> Reset Password
        </button>
        @if (myProfile()?.access_level === 4 && u.access_level < 4) {
          <button mat-stroked-button (click)="impersonate()">
            <mat-icon>supervisor_account</mat-icon> Impersonate
          </button>
        }
        <button mat-stroked-button color="warn" (click)="deleteUser()">
          <mat-icon>delete</mat-icon> Delete
        </button>
      </div>

      @if (tempPassword()) {
        <div class="temp-pw-box">
          <p>Temporary password (shown once):</p>
          <code>{{ tempPassword() }}</code>
        </div>
      }

      @if (actionError()) { <p class="error-text">{{ actionError() }}</p> }

      <h3>Sessions</h3>
      <button mat-stroked-button color="warn" (click)="revokeAllSessions()">Revoke All</button>
      <div class="session-list">
        @for (s of sessions(); track s.id) {
          <div class="session-row">
            <span class="session-ua">{{ s.user_agent ?? 'Unknown' }}</span>
            <span class="session-meta">{{ s.last_used_at ?? '—' }}</span>
            <button mat-stroked-button class="small-btn" (click)="revokeSession(s.id)">Revoke</button>
          </div>
        }
        @if (sessions().length === 0) {
          <p class="empty-text">No active sessions.</p>
        }
      </div>
    }
  `,
  styles: `
    h2 { margin: 0 0 1rem; }
    h3 { margin: 1.5rem 0 0.5rem; }
    .info-section { margin-bottom: 1rem; }
    .info-row { display: flex; gap: 1rem; padding: 4px 0; }
    .label { font-weight: 600; min-width: 100px; opacity: 0.6; }
    .badge { font-size: 0.6875rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;
      &.locked { background: rgba(244,67,54,0.2); color: #f44336; }
      &.pw { background: rgba(255,165,0,0.2); color: #ffa500; }
    }
    .action-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .error-text { color: #f44336; font-size: 0.8125rem; margin-top: 0.5rem; }
    .temp-pw-box {
      background: rgba(76,175,80,0.15); border-radius: 8px; padding: 12px 16px; margin: 0.5rem 0;
      p { margin: 0 0 0.25rem; font-size: 0.8125rem; }
      code { font-size: 1.25rem; font-weight: 700; letter-spacing: 0.05em; }
    }
    .session-list { margin-top: 0.5rem; }
    .session-row {
      display: flex; align-items: center; gap: 0.75rem; padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .session-ua { flex: 1; font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .session-meta { font-size: 0.75rem; opacity: 0.4; flex-shrink: 0; }
    .small-btn { font-size: 0.75rem; }
    .empty-text { opacity: 0.5; font-size: 0.8125rem; }
  `,
})
export class UserDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  readonly user = signal<UserDetail | null>(null);
  readonly sessions = signal<Session[]>([]);
  readonly myProfile = signal<ProfileInfo | null>(null);
  readonly tempPassword = signal('');
  readonly actionError = signal('');

  private userId = 0;

  async ngOnInit(): Promise<void> {
    this.userId = Number(this.route.snapshot.paramMap.get('userId'));
    const [profile, users, sessionsData] = await Promise.all([
      firstValueFrom(this.http.get<ProfileInfo>('/api/v1/profile')),
      firstValueFrom(this.http.get<{ users: UserDetail[] }>('/api/v1/users')),
      firstValueFrom(this.http.get<{ sessions: Session[] }>(`/api/v1/users/${this.userId}/sessions`)),
    ]);
    this.myProfile.set(profile);
    this.user.set(users.users.find(u => u.id === this.userId) ?? null);
    this.sessions.set(sessionsData.sessions);
  }

  async resetPassword(): Promise<void> {
    this.actionError.set('');
    this.tempPassword.set('');
    try {
      const r = await firstValueFrom(this.http.post<{ ok: boolean; temporary_password?: string; error?: string }>(
        `/api/v1/users/${this.userId}/reset-password`, {}));
      if (r.temporary_password) {
        this.tempPassword.set(r.temporary_password);
      } else {
        this.actionError.set(r.error ?? 'Failed');
      }
    } catch (e: unknown) {
      this.actionError.set((e as { error?: { error?: string } })?.error?.error ?? 'Request failed');
    }
  }

  async impersonate(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`/api/v1/auth/impersonate/${this.userId}`, {}));
      window.location.href = '/app/';
    } catch (e: unknown) {
      this.actionError.set((e as { error?: { error?: string } })?.error?.error ?? 'Impersonation failed');
    }
  }

  async deleteUser(): Promise<void> {
    const u = this.user();
    if (!u) return;
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try {
      await firstValueFrom(this.http.delete(`/api/v1/users/${this.userId}`));
      this.router.navigate(['/users']);
    } catch (e: unknown) {
      this.actionError.set((e as { error?: { error?: string } })?.error?.error ?? 'Delete failed');
    }
  }

  async revokeSession(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/v1/users/${this.userId}/sessions/${id}`));
    this.sessions.update(s => s.filter(x => x.id !== id));
  }

  async revokeAllSessions(): Promise<void> {
    if (!confirm('Revoke all sessions for this user? They will be signed out everywhere.')) return;
    await firstValueFrom(this.http.post(`/api/v1/users/${this.userId}/sessions/revoke-all`, {}));
    this.sessions.set([]);
  }
}
