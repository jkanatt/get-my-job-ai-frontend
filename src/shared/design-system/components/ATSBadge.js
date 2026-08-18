'use client';

export default function ATSBadge({ score = 0, size = 'sm' }) {
  const dim = size === 'lg' ? 64 : 40;
  const r = dim / 2 - 4;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 70 ? 'var(--c-accent)' : score >= 40 ? 'var(--c-warning)' : 'var(--c-danger)';
  const fontSize = size === 'lg' ? '14px' : '10px';

  return (
    <div className="relative" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
        <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${c}`} strokeDashoffset={offset} strokeLinecap="butt"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-bold font-mono" style={{ fontSize, color }}>
        {score}%
      </div>
    </div>
  );
}
