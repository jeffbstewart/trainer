import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth.service';
import { WebAuthnService } from '../../core/webauthn.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatDividerModule, MatProgressSpinnerModule],
  template: `
    <div class="login-page">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Sign In</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (error()) {
            <div class="error-message">{{ error() }}</div>
          }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Username</mat-label>
            <input matInput [value]="username()" (input)="username.set($any($event.target).value)"
                   (keydown.enter)="onSubmit()" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Password</mat-label>
            <input matInput type="password" [value]="password()" (input)="password.set($any($event.target).value)"
                   (keydown.enter)="onSubmit()" />
          </mat-form-field>
          <button mat-flat-button color="primary" class="full-width" (click)="onSubmit()"
                  [disabled]="submitting()">
            @if (submitting()) { <mat-spinner diameter="18" /> }
            Sign In
          </button>

          @if (passkeysAvailable()) {
            <mat-divider class="passkey-divider" />
            <button mat-stroked-button class="full-width" [disabled]="passkeyLoading()"
                    (click)="onPasskeyLogin()">
              @if (passkeyLoading()) { <mat-spinner diameter="18" /> }
              Sign in with passkey
            </button>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .login-page { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 1rem; }
    .login-card { max-width: 380px; width: 100%; }
    .full-width { width: 100%; }
    .error-message { background: rgba(244,67,54,0.15); color: #f44336; padding: 10px 16px; border-radius: 6px; font-size: 0.875rem; margin-bottom: 1rem; }
    .passkey-divider { margin: 1.25rem 0; }
  `,
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly webauthn = inject(WebAuthnService);

  readonly username = signal('');
  readonly password = signal('');
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly passkeysAvailable = signal(false);
  readonly passkeyLoading = signal(false);

  async ngOnInit(): Promise<void> {
    if (await this.auth.checkSession()) {
      this.router.navigate(['/']);
      return;
    }
    try {
      const d = await this.auth.discover();
      if (d.setup_required) { this.router.navigate(['/setup']); return; }
      this.passkeysAvailable.set(!!d.passkeys_available && this.webauthn.isSupported());
    } catch { /* server unreachable */ }
  }

  async onSubmit(): Promise<void> {
    if (!this.username().trim() || !this.password()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const response = await this.auth.login(this.username(), this.password());
      this.handleLoginResponse(response);
    } catch (e: unknown) {
      const err = e as { error?: { error?: string; retry_after?: number } };
      if (err.error?.retry_after) {
        this.error.set(`Too many attempts. Try again in ${err.error.retry_after} seconds.`);
      } else {
        this.error.set(err.error?.error ?? 'Login failed');
      }
    }
    this.submitting.set(false);
  }

  async onPasskeyLogin(): Promise<void> {
    this.passkeyLoading.set(true);
    this.error.set('');
    try {
      const response = await this.auth.loginWithPasskey();
      this.handleLoginResponse(response);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        this.passkeyLoading.set(false);
        return;
      }
      const err = e as { error?: { error?: string } };
      this.error.set(err.error?.error ?? 'Passkey authentication failed');
    }
    this.passkeyLoading.set(false);
  }

  private handleLoginResponse(response: { ok: boolean; password_change_required?: boolean; legal_acceptance_required?: boolean }): void {
    if (response.password_change_required) {
      this.router.navigate(['/change-password']);
      return;
    }
    if (response.legal_acceptance_required) {
      this.router.navigate(['/accept-legal']);
      return;
    }
    this.router.navigate(['/']);
  }
}
