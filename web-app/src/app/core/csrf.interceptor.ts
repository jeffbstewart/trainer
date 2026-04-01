import { HttpInterceptorFn } from '@angular/common/http';

/** Adds X-Requested-With header to all requests for CSRF protection. */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const cloned = req.clone({
    setHeaders: { 'X-Requested-With': 'XMLHttpRequest' }
  });
  return next(cloned);
};
