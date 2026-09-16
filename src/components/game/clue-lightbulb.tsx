export function ClueLightbulb(props: { on: boolean }) {
  const label = props.on ? "Warning light is on" : "Light is off";
  return (
    <div className="flex flex-col items-center gap-2 py-2" role="img" aria-label={label}>
      <div
        className={`relative flex items-center justify-center ${
          props.on ? "drop-shadow-[0_0_28px_rgba(251,191,36,0.85)]" : ""
        }`}
      >
        {props.on ? (
          <div
            className="absolute size-36 rounded-full bg-amber-400/30 blur-2xl sm:size-44"
            aria-hidden
          />
        ) : null}
        <svg
          viewBox="0 0 120 180"
          className="relative h-44 w-32 sm:h-56 sm:w-40 lg:h-64 lg:w-44"
          aria-hidden
        >
          <defs>
            <radialGradient id="bulb-glass-on" cx="42%" cy="32%" r="70%">
              <stop offset="0%" stopColor="#fff7cc" />
              <stop offset="45%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </radialGradient>
            <radialGradient id="bulb-glass-off" cx="42%" cy="32%" r="70%">
              <stop offset="0%" stopColor="#4b5563" />
              <stop offset="55%" stopColor="#1f2937" />
              <stop offset="100%" stopColor="#111827" />
            </radialGradient>
          </defs>
          <ellipse
            cx="60"
            cy="58"
            rx="42"
            ry="50"
            fill={props.on ? "url(#bulb-glass-on)" : "url(#bulb-glass-off)"}
            stroke={props.on ? "#f59e0b" : "#6b7280"}
            strokeWidth="3"
          />
          <path
            d="M32 92 C32 108 48 118 60 118 C72 118 88 108 88 92"
            fill={props.on ? "#f59e0b" : "#1f2937"}
            stroke={props.on ? "#d97706" : "#6b7280"}
            strokeWidth="3"
          />
          {props.on ? (
            <>
              <path
                d="M48 48 Q54 62 48 76"
                fill="none"
                stroke="#fffbeb"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M60 44 Q66 62 60 80"
                fill="none"
                stroke="#fffbeb"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M72 48 Q66 62 72 76"
                fill="none"
                stroke="#fffbeb"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <path
                d="M48 50 L48 76"
                fill="none"
                stroke="#6b7280"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M60 46 L60 78"
                fill="none"
                stroke="#6b7280"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M72 50 L72 76"
                fill="none"
                stroke="#6b7280"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </>
          )}
          <rect x="46" y="116" width="28" height="8" rx="1" fill="#9ca3af" />
          <rect x="44" y="124" width="32" height="8" rx="1" fill="#6b7280" />
          <rect x="44" y="132" width="32" height="8" rx="1" fill="#9ca3af" />
          <rect x="44" y="140" width="32" height="8" rx="1" fill="#6b7280" />
          <path d="M50 148 H70 L64 162 H56 Z" fill="#4b5563" />
        </svg>
      </div>
      <p
        className={`text-lg font-semibold tracking-wide ${
          props.on ? "text-amber-200" : "text-zinc-400"
        }`}
      >
        {props.on ? "ON" : "OFF"}
      </p>
    </div>
  );
}
