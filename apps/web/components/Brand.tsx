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
