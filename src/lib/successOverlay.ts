const KEYFRAME_ID = 'success-overlay-kf';

function ensureKeyframes() {
  if (document.getElementById(KEYFRAME_ID)) return;
  const s = document.createElement('style');
  s.id = KEYFRAME_ID;
  s.textContent = [
    '@keyframes soFadeIn{from{opacity:0}to{opacity:1}}',
    '@keyframes soFadeOut{from{opacity:1}to{opacity:0}}',
    '@keyframes soCircle{from{transform:scale(0)}to{transform:scale(1)}}',
  ].join('');
  document.head.appendChild(s);
}

interface SuccessOverlayOptions {
  title: string;
  subtitle: string;
  /** Optional raw HTML injected between the checkmark and the title (e.g. amount + animation). */
  extraHtml?: string;
  /** Called after the close animation finishes. Use this to fire refetches/invalidations. */
  onClose?: () => void;
}

export function showSuccessOverlay({ title, subtitle, extraHtml, onClose }: SuccessOverlayOptions): () => void {
  ensureKeyframes();

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:99998;',
    'background:rgba(0,0,0,0.6);',
    'display:flex;align-items:center;justify-content:center;padding:24px;',
    'animation:soFadeIn 0.3s ease-out forwards;',
  ].join('');

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.style.animation = 'soFadeOut 0.3s ease-out forwards';
    setTimeout(() => {
      overlay.remove();
      onClose?.();
    }, 300);
  };
  overlay.addEventListener('click', close);

  // Solid card — uses CSS variables so it respects light/dark theme
  const card = document.createElement('div');
  card.style.cssText = [
    'background:hsl(var(--card));',
    'border-radius:20px;padding:36px 28px 32px;',
    'max-width:360px;width:100%;',
    'display:flex;flex-direction:column;align-items:center;gap:16px;',
    'box-shadow:0 24px 64px rgba(0,0,0,0.35);position:relative;',
  ].join('');
  card.addEventListener('click', (e) => e.stopPropagation());

  // X close button — type=button prevents any accidental form submit; addEventListener is more reliable than onclick
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  closeBtn.style.cssText = [
    'position:absolute;top:14px;right:14px;',
    'width:32px;height:32px;border-radius:50%;border:none;',
    'background:hsl(var(--muted));color:hsl(var(--muted-foreground));',
    'cursor:pointer;display:flex;align-items:center;justify-content:center;',
    'pointer-events:all;z-index:1;',
  ].join('');
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });

  // Green checkmark circle
  const check = document.createElement('div');
  check.style.cssText = [
    'width:72px;height:72px;border-radius:50%;background:#10B981;',
    'display:flex;align-items:center;justify-content:center;',
    'animation:soCircle 0.4s ease-out forwards;flex-shrink:0;',
  ].join('');
  check.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const titleEl = document.createElement('p');
  titleEl.textContent = title;
  titleEl.style.cssText = 'color:hsl(var(--foreground));font-size:20px;font-weight:700;letter-spacing:-0.3px;margin:0;text-align:center;';

  const subtitleEl = document.createElement('p');
  subtitleEl.textContent = subtitle;
  subtitleEl.style.cssText = 'color:hsl(var(--muted-foreground));font-size:14px;margin:0;text-align:center;';

  card.appendChild(closeBtn);
  card.appendChild(check);

  if (extraHtml) {
    const extra = document.createElement('div');
    extra.style.cssText = 'width:100%;display:flex;flex-direction:column;align-items:center;gap:12px;';
    extra.innerHTML = extraHtml;
    card.appendChild(extra);
  }

  card.appendChild(titleEl);
  card.appendChild(subtitleEl);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  return close;
}
