export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 129 34"
      fill="currentColor"
      role="img"
      aria-label="Ding"
      className={className}
    >
      <rect y="1" width="32" height="32" rx="4" />
      <circle cx="63" cy="17" r="17" />
      <path d="M107.536 2C109.075 -0.666666 112.925 -0.666666 114.464 2L128.321 26C129.86 28.6667 127.936 32 124.856 32H97.1436C94.0644 32 92.1399 28.6667 93.6795 26L107.536 2Z" />
    </svg>
  );
}
