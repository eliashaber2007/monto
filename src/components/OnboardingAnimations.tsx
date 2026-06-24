export function CoinsPotAnimation() {
  return (
    <div className="flex justify-center mb-4">
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
        {/* Pot */}
        <g className="onboarding-pot-glow">
          <path
            d="M35 50 Q35 75 60 75 Q85 75 85 50 L85 45 L35 45 Z"
            fill="hsl(221 83% 53% / 0.15)"
            stroke="hsl(221 83% 53%)"
            strokeWidth="2"
          />
          <path
            d="M30 45 L90 45"
            stroke="hsl(221 83% 53%)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Pot rim */}
          <ellipse cx="60" cy="45" rx="30" ry="4" fill="hsl(221 83% 53% / 0.1)" stroke="hsl(221 83% 53%)" strokeWidth="1.5" />
        </g>

        {/* Coin 1 - from left */}
        <g className="onboarding-coin-1" style={{ transformOrigin: '60px 42px' }}>
          <circle cx="60" cy="42" r="8" fill="hsl(38 92% 50%)" stroke="hsl(38 92% 40%)" strokeWidth="1.5" />
          <text x="60" y="46" textAnchor="middle" fontSize="9" fill="hsl(38 92% 20%)" fontWeight="bold">€</text>
        </g>

        {/* Coin 2 - from right */}
        <g className="onboarding-coin-2" style={{ transformOrigin: '60px 42px' }}>
          <circle cx="60" cy="42" r="7" fill="hsl(252 96% 67%)" stroke="hsl(252 80% 55%)" strokeWidth="1.5" />
          <text x="60" y="46" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">€</text>
        </g>

        {/* Coin 3 - from top */}
        <g className="onboarding-coin-3" style={{ transformOrigin: '60px 42px' }}>
          <circle cx="60" cy="42" r="7.5" fill="hsl(221 83% 53%)" stroke="hsl(221 83% 43%)" strokeWidth="1.5" />
          <text x="60" y="46" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">€</text>
        </g>

        {/* People silhouettes */}
        {/* Left person */}
        <circle cx="18" cy="18" r="5" fill="hsl(221 83% 53% / 0.5)" />
        <path d="M10 35 Q10 26 18 26 Q26 26 26 35" fill="hsl(221 83% 53% / 0.3)" />
        
        {/* Right person */}
        <circle cx="102" cy="20" r="5" fill="hsl(252 96% 67% / 0.5)" />
        <path d="M94 37 Q94 28 102 28 Q110 28 110 37" fill="hsl(252 96% 67% / 0.3)" />
        
        {/* Top person */}
        <circle cx="60" cy="6" r="4.5" fill="hsl(221 83% 65% / 0.5)" />
        <path d="M53 20 Q53 13 60 13 Q67 13 67 20" fill="hsl(221 83% 65% / 0.3)" />
      </svg>
    </div>
  );
}

export function ProgressRingAnimation() {
  return (
    <div className="flex justify-center mb-4">
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
        {/* Phone outline */}
        <rect x="35" y="5" width="50" height="80" rx="8" fill="hsl(221 83% 53% / 0.06)" stroke="hsl(221 83% 53% / 0.3)" strokeWidth="1.5" />
        {/* Screen area */}
        <rect x="39" y="12" width="42" height="62" rx="2" fill="hsl(221 83% 53% / 0.03)" />
        {/* Notch */}
        <rect x="52" y="7" width="16" height="3" rx="1.5" fill="hsl(221 83% 53% / 0.15)" />

        {/* Progress ring */}
        <circle cx="60" cy="43" r="20" stroke="hsl(221 83% 53% / 0.12)" strokeWidth="3.5" fill="none" />
        <circle
          cx="60" cy="43" r="20"
          stroke="url(#ringGradient)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          transform="rotate(-90 60 43)"
          className="onboarding-ring"
        />

        {/* Checkmark */}
        <path
          d="M50 43 L57 50 L70 37"
          stroke="hsl(142 71% 45%)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="onboarding-check"
        />

        {/* Gradient def */}
        <defs>
          <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(221 83% 53%)" />
            <stop offset="100%" stopColor="hsl(252 96% 67%)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Raw SVG string exported so it can be injected into imperative DOM overlays.
// Shows Monto logo (left) → animated dots → bank building (right). No flip needed.
export const bankConnectSvgHtml = `<svg width="200" height="80" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Monto logo on the left -->
  <image href="/monto_logo.svg" x="5" y="15" width="50" height="50"/>
  <!-- Wide connecting line with animated dots -->
  <line x1="62" y1="40" x2="138" y2="40" stroke="hsl(252 96% 67% / 0.35)" stroke-width="1.5" stroke-dasharray="4 4" class="onboarding-connect-line"/>
  <circle cx="80" cy="40" r="2" fill="hsl(221 83% 53%)" class="onboarding-pulse-dot"/>
  <circle cx="100" cy="40" r="2" fill="hsl(252 96% 67%)" class="onboarding-pulse-dot" style="animation-delay:0.35s"/>
  <circle cx="120" cy="40" r="2" fill="hsl(221 83% 53%)" class="onboarding-pulse-dot" style="animation-delay:0.7s"/>
  <!-- Bank building on the right -->
  <g>
    <path d="M143 42 L163 27 L183 42 Z" fill="hsl(221 83% 53% / 0.15)" stroke="hsl(221 83% 53%)" stroke-width="1.5"/>
    <rect x="146" y="42" width="34" height="22" fill="hsl(221 83% 53% / 0.08)" stroke="hsl(221 83% 53%)" stroke-width="1.5"/>
    <line x1="153" y1="44" x2="153" y2="62" stroke="hsl(221 83% 53% / 0.5)" stroke-width="2"/>
    <line x1="163" y1="44" x2="163" y2="62" stroke="hsl(221 83% 53% / 0.5)" stroke-width="2"/>
    <line x1="173" y1="44" x2="173" y2="62" stroke="hsl(221 83% 53% / 0.5)" stroke-width="2"/>
    <rect x="143" y="64" width="40" height="4" rx="1" fill="hsl(221 83% 53% / 0.2)" stroke="hsl(221 83% 53%)" stroke-width="1"/>
  </g>
</svg>`;

export function BankConnectAnimation() {
  return (
    <div className="flex justify-center mb-4">
      <svg width="140" height="80" viewBox="0 0 140 80" fill="none">
        {/* Bank building */}
        <g>
          {/* Roof triangle */}
          <path d="M15 30 L35 15 L55 30 Z" fill="hsl(221 83% 53% / 0.15)" stroke="hsl(221 83% 53%)" strokeWidth="1.5" />
          {/* Base */}
          <rect x="18" y="30" width="34" height="25" fill="hsl(221 83% 53% / 0.08)" stroke="hsl(221 83% 53%)" strokeWidth="1.5" />
          {/* Columns */}
          <line x1="25" y1="32" x2="25" y2="53" stroke="hsl(221 83% 53% / 0.5)" strokeWidth="2" />
          <line x1="35" y1="32" x2="35" y2="53" stroke="hsl(221 83% 53% / 0.5)" strokeWidth="2" />
          <line x1="45" y1="32" x2="45" y2="53" stroke="hsl(221 83% 53% / 0.5)" strokeWidth="2" />
          {/* Steps */}
          <rect x="15" y="55" width="40" height="4" rx="1" fill="hsl(221 83% 53% / 0.2)" stroke="hsl(221 83% 53%)" strokeWidth="1" />
        </g>

        {/* Connecting line with animated dots */}
        <line x1="58" y1="42" x2="82" y2="42" stroke="hsl(252 96% 67% / 0.3)" strokeWidth="1.5" strokeDasharray="3 3" className="onboarding-connect-line" />
        
        {/* Animated dots along line */}
        <circle cx="63" cy="42" r="1.5" fill="hsl(221 83% 53%)" className="onboarding-pulse-dot" />
        <circle cx="70" cy="42" r="1.5" fill="hsl(252 96% 67%)" className="onboarding-pulse-dot" style={{ animationDelay: '0.3s' }} />
        <circle cx="77" cy="42" r="1.5" fill="hsl(221 83% 53%)" className="onboarding-pulse-dot" style={{ animationDelay: '0.6s' }} />

        {/* Phone / wallet */}
        <g>
          <rect x="85" y="22" width="30" height="45" rx="5" fill="hsl(252 96% 67% / 0.08)" stroke="hsl(252 96% 67%)" strokeWidth="1.5" />
          <rect x="89" y="28" width="22" height="30" rx="2" fill="hsl(252 96% 67% / 0.04)" />
          {/* Wallet icon inside phone */}
          <rect x="93" y="36" width="14" height="10" rx="2" fill="hsl(252 96% 67% / 0.15)" stroke="hsl(252 96% 67% / 0.5)" strokeWidth="1" />
          <circle cx="104" cy="41" r="2" fill="hsl(252 96% 67% / 0.4)" />
          {/* Notch */}
          <rect x="95" y="24" width="10" height="2.5" rx="1.25" fill="hsl(252 96% 67% / 0.15)" />
        </g>

        {/* Lock icon - appears after connection */}
        <g className="onboarding-lock" style={{ transformOrigin: '70px 62px' }}>
          {/* Lock body */}
          <rect x="64" y="60" width="12" height="9" rx="2" fill="hsl(142 71% 45%)" />
          {/* Lock shackle */}
          <path d="M66.5 60 L66.5 57 Q66.5 54 70 54 Q73.5 54 73.5 57 L73.5 60" stroke="hsl(142 71% 45%)" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Keyhole */}
          <circle cx="70" cy="64" r="1.5" fill="white" />
        </g>
      </svg>
    </div>
  );
}