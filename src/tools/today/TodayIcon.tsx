export function TodayIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="-1 0 34 34"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <rect y="1" width="24" height="8" rx="4" />
      <rect y="13" width="32" height="8" rx="4" />
      <rect y="25" width="16" height="8" rx="4" />
    </svg>
  );
}
