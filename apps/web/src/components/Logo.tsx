/** Isotipo de SIGPI (una caja): marca ficticia del demo. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--color-marino-600)" />
      <path d="M8 11.5 16 7l8 4.5v9L16 25l-8-4.5z" fill="none" stroke="var(--color-teal)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M8 11.5 16 16l8-4.5M16 16v9" fill="none" stroke="white" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}
