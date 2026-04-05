import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { firstValueFrom } from 'rxjs';

export interface Passkey {
  id: number;
  display_name: string;
  created_at: string | null;
  last_used_at: string | null;
}

interface ChallengeResponse<T> {
  challenge: string;
  options: T;
}

@Injectable({ providedIn: 'root' })
export class WebAuthnService {
  private readonly http = inject(HttpClient);

  isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential;
  }

  async performAuthentication(): Promise<{
    ok: boolean;
    password_change_required?: boolean;
    legal_acceptance_required?: boolean;
  }> {
    const { challenge, options } = await firstValueFrom(
      this.http.post<ChallengeResponse<PublicKeyCredentialRequestOptionsJSON>>(
        '/api/v1/auth/passkey/authentication-options', {})
    );
    const credential = await startAuthentication({ optionsJSON: options });
    return firstValueFrom(
      this.http.post<{
        ok: boolean;
        password_change_required?: boolean;
        legal_acceptance_required?: boolean;
      }>('/api/v1/auth/passkey/authenticate', { challenge, credential })
    );
  }

  async performRegistration(displayName?: string): Promise<{ ok: boolean }> {
    const { challenge, options } = await firstValueFrom(
      this.http.post<ChallengeResponse<PublicKeyCredentialCreationOptionsJSON>>(
        '/api/v1/auth/passkeys/registration-options', {})
    );
    const credential = await startRegistration({ optionsJSON: options });
    return firstValueFrom(
      this.http.post<{ ok: boolean }>('/api/v1/auth/passkeys/register', {
        challenge, credential, display_name: displayName || 'Passkey',
      })
    );
  }

  async listPasskeys(): Promise<Passkey[]> {
    const res = await firstValueFrom(
      this.http.get<{ passkeys: Passkey[] }>('/api/v1/auth/passkeys')
    );
    return res.passkeys;
  }

  async deletePasskey(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/v1/auth/passkeys/${id}`));
  }
}
