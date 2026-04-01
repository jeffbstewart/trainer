import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface DiscoverResponse {
  setup_required: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authenticated = signal(false);

  readonly isAuthenticated = computed(() => this.authenticated());

  async discover(): Promise<DiscoverResponse> {
    return firstValueFrom(this.http.get<DiscoverResponse>('/api/auth/discover'));
  }

  async login(username: string, password: string): Promise<{ ok: boolean; password_change_required?: boolean }> {
    const response = await firstValueFrom(
      this.http.post<{ ok: boolean; password_change_required?: boolean }>('/api/auth/login', { username, password })
    );
    if (response.ok) this.authenticated.set(true);
    return response;
  }

  async setup(username: string, password: string): Promise<{ ok: boolean }> {
    const response = await firstValueFrom(
      this.http.post<{ ok: boolean }>('/api/auth/setup', { username, password })
    );
    if (response.ok) this.authenticated.set(true);
    return response;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}));
    this.authenticated.set(false);
  }

  async checkSession(): Promise<boolean> {
    try {
      await firstValueFrom(this.http.get('/api/profile'));
      this.authenticated.set(true);
      return true;
    } catch {
      this.authenticated.set(false);
      return false;
    }
  }
}
