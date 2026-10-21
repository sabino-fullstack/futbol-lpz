export default function Balon({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#ffffff" stroke="#12161a" strokeWidth="4" />
      <polygon points="50,30 69.02,43.82 61.76,66.18 38.24,66.18 30.98,43.82" fill="#12161a" />
      <g stroke="#12161a" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M50 30 L50 4" />
        <path d="M69.02 43.82 L93.75 35.78" />
        <path d="M61.76 66.18 L77.04 87.21" />
        <path d="M38.24 66.18 L22.96 87.21" />
        <path d="M30.98 43.82 L6.25 35.78" />
      </g>
      <g fill="#12161a">
        <polygon points="0,-7 6.66,-2.16 4.11,5.66 -4.11,5.66 -6.66,-2.16" transform="translate(71.16 20.88) rotate(-144)" />
        <polygon points="0,-7 6.66,-2.16 4.11,5.66 -4.11,5.66 -6.66,-2.16" transform="translate(84.24 61.12) rotate(-72)" />
        <polygon points="0,-7 6.66,-2.16 4.11,5.66 -4.11,5.66 -6.66,-2.16" transform="translate(50 86)" />
        <polygon points="0,-7 6.66,-2.16 4.11,5.66 -4.11,5.66 -6.66,-2.16" transform="translate(15.76 61.12) rotate(72)" />
        <polygon points="0,-7 6.66,-2.16 4.11,5.66 -4.11,5.66 -6.66,-2.16" transform="translate(28.84 20.88) rotate(144)" />
      </g>
    </svg>
  )
}