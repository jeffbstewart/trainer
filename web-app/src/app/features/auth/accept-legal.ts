import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-accept-legal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatButtonModule, MatCheckboxModule],
  template: `
    <div class="legal-page">
      <mat-card class="legal-card">
        <mat-card-header>
          <mat-card-title>Updated Terms</mat-card-title>
          <mat-card-subtitle>Please review and accept the updated legal documents to continue.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (error()) {
            <div class="error-message">{{ error() }}</div>
          }

          <div class="legal-docs">
            @if (termsUrl()) {
              <div class="doc-row">
                <mat-checkbox [checked]="termsAccepted()" (change)="termsAccepted.set($event.checked)">
                  I have read and agree to the
                  <a [href]="termsUrl()" target="_blank" rel="noopener">Terms of Use</a>
                </mat-checkbox>
              </div>
            }
            @if (privacyUrl()) {
              <div class="doc-row">
                <mat-checkbox [checked]="privacyAccepted()" (change)="privacyAccepted.set($event.checked)">
                  I have read and agree to the
                  <a [href]="privacyUrl()" target="_blank" rel="noopener">Privacy Policy</a>
                </mat-checkbox>
              </div>
            }
          </div>

          <button mat-flat-button color="primary" class="full-width"
                  [disabled]="!canProceed() || submitting()"
                  (click)="onAccept()">
            Continue
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .legal-page { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 1rem; }
    .legal-card { max-width: 480px; width: 100%; }
    .full-width { width: 100%; }
    .error-message { background: rgba(244,67,54,0.15); color: #f44336; padding: 10px 16px; border-radius: 6px; font-size: 0.875rem; margin-bottom: 1rem; }
    .legal-docs { margin: 1rem 0; }
    .doc-row { margin-bottom: 0.75rem; }
    a { color: var(--mat-sys-primary, #bb86fc); }
  `,
})
export class AcceptLegalComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly termsUrl = signal('');
  readonly privacyUrl = signal('');
  readonly termsAccepted = signal(false);
  readonly privacyAccepted = signal(false);
  readonly error = signal('');
  readonly submitting = signal(false);

  canProceed(): boolean {
    if (this.termsUrl() && !this.termsAccepted()) return false;
    if (this.privacyUrl() && !this.privacyAccepted()) return false;
    return true;
  }

  async ngOnInit(): Promise<void> {
    try {
      const d = await this.auth.discover();
      this.termsUrl.set(d.terms_of_use_url ?? '');
      this.privacyUrl.set(d.privacy_policy_url ?? '');
    } catch { /* ignore */ }
  }

  async onAccept(): Promise<void> {
    this.submitting.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.post('/api/v1/auth/accept-legal', {}));
      this.router.navigate(['/']);
    } catch {
      this.error.set('Failed to record agreement. Please try again.');
    }
    this.submitting.set(false);
  }
}
