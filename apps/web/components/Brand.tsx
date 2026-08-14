export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" fill="var(--color-lime)" stroke="var(--color-ink)" strokeWidth="2" />
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="800"
        fontSize="14"
        fill="var(--color-ink)"
      >
        $
      </text>
    </svg>
  );
}

export function IconReceipt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5h10v15H7z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 8.5h5M9.5 12h5M9.5 15.5h3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconPay() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12h8M14 9.5 16.5 12 14 14.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7.5 9.2 5.5h5.6L16 7.5h3.5v11H4.5v-11H8z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconUpload() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V7M8.5 10.5 12 7l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5 18.5h14" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

export function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function IconTap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="3.5" width="8" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 14.5c-2 1.2-3 3-3 5.5h16c0-2.5-1-4.3-3-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconShare() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="6.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="17.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11.2 15 7.4M8 12.8 15 16.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconStar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.4 14.47 9.1l6.13.54-4.7 4.12 1.4 6-5.3-3.18L5.7 19.76l1.4-6-4.7-4.12 6.13-.54L12 3.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function IconGithub({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </svg>
  );
}
