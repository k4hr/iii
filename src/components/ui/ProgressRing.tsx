export function ProgressRing({value, label, size = 136}: {value: number; label?: string; size?: number}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safe / 100) * circumference;

  return (
    <div className="progress-ring" style={{width: size}}>
      <div className="progress-ring__visual" style={{width: size, height: size}}>
        <svg viewBox="0 0 120 120" role="img" aria-label={`${label ?? 'Progress'}: ${safe}%`}>
          <defs>
            <linearGradient id={`ring-${safe}-${size}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7cf8e8" />
              <stop offset=".55" stopColor="#20d7d2" />
              <stop offset="1" stopColor="#0b7c91" />
            </linearGradient>
          </defs>
          <circle className="progress-ring__track" cx="60" cy="60" r={radius} />
          <circle
            className="progress-ring__value"
            cx="60"
            cy="60"
            r={radius}
            stroke={`url(#ring-${safe}-${size})`}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="progress-ring__number">{safe}<span>%</span></div>
      </div>
      {label && <div className="progress-ring__label">{label}</div>}
    </div>
  );
}
