import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface DiscoverResponse {
  setup_required: boolean;
  terms_of_use_url?: string;
  privacy_policy_url?: string;
  terms_of_use_version?: number;
  privacy_policy_version?: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authenticated = signal(false);

  readonly isAuthenticated = computed(() => this.authenticated());

  async discover(): Promise<DiscoverResponse> {
    return firstValueFrom(this.http.get<DiscoverResponse>('/api/v1/auth/discover'));
  }

  async login(username: string, password: string): Promise<{ ok: boolean; password_change_required?: boolean; legal_acceptance_required?: boolean }> {
    const response = await firstValueFrom(
      this.http.post<{ ok: boolean; password_change_required?: boolean; legal_acceptance_required?: boolean }>('/api/v1/auth/login', { username, password })
    );
    if (response.ok) this.authenticated.set(true);
    return response;
  }

  async setup(username: string, password: string, termsUrl: string, privacyUrl: string): Promise<{ ok: boolean }> {
    const response = await firstValueFrom(
      this.http.post<{ ok: boolean }>('/api/v1/auth/setup', {
        username, password,
        terms_of_use_url: termsUrl || undefined,
        privacy_policy_url: privacyUrl || undefined,
      })
    );
    if (response.ok) this.authenticated.set(true);
    return response;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/v1/auth/logout', {}));
    this.authenticated.set(false);
  }

  async checkSession(): Promise<boolean> {
    try {
      await firstValueFrom(this.http.get('/api/v1/profile'));
      this.authenticated.set(true);
      return true;
    } catch {
      this.authenticated.set(false);
      return false;
    }
  }
}
