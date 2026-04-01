import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const setupGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  try {
    const discover = await auth.discover();
    if (discover.setup_required) return true;
    return router.createUrlTree(['/login']);
  } catch {
    return router.createUrlTree(['/login']);
  }
};
