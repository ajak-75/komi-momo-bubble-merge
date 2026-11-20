import './styles.css';
import { bootstrap } from './app';

bootstrap().catch((err: unknown) => {
  // Keep the failure visible for whoever opens the console instead of a blank screen.
  console.error('[KOMI & MOMO] boot failed', err);
  const fallback = document.createElement('p');
  fallback.style.cssText = 'color:#ffe9a8;font:600 14px/1.5 system-ui;padding:24px;text-align:center';
  fallback.textContent = 'Loading failed — please reload the page.';
  document.body.appendChild(fallback);
});
