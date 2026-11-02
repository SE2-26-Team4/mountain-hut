/**
 * Mountain Hut brand mark with its wordmark.
 *
 * @param {{ stacked?: boolean, className?: string }} props
 */
export default function MountainLogo({ stacked = false, className = '' }) {
  const classes = ['mountain-logo', stacked ? 'mountain-logo--stacked' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      <svg
        className="mountain-logo__mark"
        viewBox="0 0 48 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 29 17 7l9 13 6-8 13 17" />
        <path d="m12 15 5 4 4-3" />
      </svg>
      <span className="mountain-logo__text">Mountain Hut</span>
    </span>
  );
}
