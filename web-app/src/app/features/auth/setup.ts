import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="setup-page">
      <mat-card class="setup-card">
        <mat-card-header>
          <mat-card-title>Welcome to Trainer</mat-card-title>
          <mat-card-subtitle>Create the first account to get started.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (error()) {
            <div class="error-message">{{ error() }}</div>
          }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Username</mat-label>
            <input matInput [value]="username()" (input)="username.set($any($event.target).value)" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Password</mat-label>
            <input matInput type="password" [value]="password()" (input)="password.set($any($event.target).value)" />
            <mat-hint>At least 8 characters</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Confirm Password</mat-label>
            <input matInput type="password" [value]="confirm()" (input)="confirm.set($any($event.target).value)"
                   (keydown.enter)="onSubmit()" />
          </mat-form-field>
          @if (confirm().length > 0 && password() !== confirm()) {
            <p class="mismatch">Passwords do not match</p>
          }

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Terms of Use URL</mat-label>
            <input matInput type="url" [value]="termsUrl()" (input)="termsUrl.set($any($event.target).value)"
                   placeholder="https://example.com/terms" />
            <mat-hint>Shown to users at login</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Privacy Policy URL</mat-label>
            <input matInput type="url" [value]="privacyUrl()" (input)="privacyUrl.set($any($event.target).value)"
                   placeholder="https://example.com/privacy" />
            <mat-hint>Shown to users at login</mat-hint>
          </mat-form-field>

          <button mat-flat-button color="primary" class="full-width" (click)="onSubmit()"
                  [disabled]="!isValid()">
            Create Account
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .setup-page { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 1rem; }
    .setup-card { max-width: 420px; width: 100%; }
    .full-width { width: 100%; }
    .error-message { background: rgba(244,67,54,0.15); color: #f44336; padding: 10px 16px; border-radius: 6px; font-size: 0.875rem; margin-bottom: 1rem; }
    .mismatch { color: #ffa500; font-size: 0.8125rem; margin: -0.5rem 0 0.5rem; }
    .legal-links { font-size: 0.8125rem; opacity: 0.6; margin: 0.5rem 0 1rem;
      a { color: var(--mat-sys-primary, #bb86fc); }
    }
  `,
})
export class SetupComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly username = signal('');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly termsUrl = signal('');
  readonly privacyUrl = signal('');
  readonly error = signal('');

  isValid(): boolean {
    return this.username().trim().length > 0
      && this.password().length >= 8
      && this.password() === this.confirm();
  }

  async onSubmit(): Promise<void> {
    if (!this.isValid()) return;
    this.error.set('');
    try {
      await this.auth.setup(this.username().trim(), this.password(), this.termsUrl().trim(), this.privacyUrl().trim());
      this.router.navigate(['/']);
    } catch (e: unknown) {
      this.error.set((e as { error?: { error?: string } })?.error?.error ?? 'Setup failed');
    }
  }
}
