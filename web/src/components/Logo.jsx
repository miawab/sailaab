import { useId } from 'react';

// The Khabardar mark: a house with water rising inside it.
// `rise` animates the water filling up (used on the intro screen).
export function LogoMark({ size = 36, rise = false }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={`logo-mark ${rise ? 'rise' : ''}`}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B5BFF" />
          <stop offset="1" stopColor="#1F2FD1" />
        </linearGradient>
        <clipPath id={`house${id}`}>
          <path d="M12 22.5 24 12l12 10.5V36a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z" />
        </clipPath>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#bg${id})`} />
      <path d="M12 22.5 24 12l12 10.5V36a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z" fill="#fff" />
      <g clipPath={`url(#house${id})`}>
        <g className="logo-water">
          <path d="M4 29c3 0 3-2.2 6-2.2s3 2.2 6 2.2 3-2.2 6-2.2 3 2.2 6 2.2 3-2.2 6-2.2 3 2.2 6 2.2 3-2.2 6-2.2V44H4z" fill="#4DB2FF" />
          <path d="M4 33c3 0 3-2 6-2s3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2V44H4z" fill="#2540F0" opacity="0.9" />
        </g>
      </g>
      <path d="M9.5 23.5 24 10.8l14.5 12.7" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Mark + both names.
export default function Logo({ size = 36, sub }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-words">
        <span className="logo-name">Khabardar <span className="logo-ur">خبردار</span></span>
        {sub && <span className="logo-sub">{sub}</span>}
      </span>
    </span>
  );
}
