export function BakoorMark({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="8" fill="currentColor" />
      <circle cx="24" cy="20" r="9" fill="#F4C36A" />
      <path d="M24 14.2C24.45 18.25 25.75 19.55 29.8 20C25.75 20.45 24.45 21.75 24 25.8C23.55 21.75 22.25 20.45 18.2 20C22.25 19.55 23.55 18.25 24 14.2Z" fill="currentColor" />
      <path d="M8.5 28.5C13.7 35.9 21.8 38.1 28.2 33.2L33.3 29.3C35.3 27.8 38.1 28 40 29.8V37.1C37.9 34.8 35.2 34.5 32.9 36.2L29.3 38.9C21.2 44.8 12 41.8 8.5 37.7V28.5Z" fill="white" />
      <path d="M24 41L27 44L24 47L21 44L24 41Z" fill="#F4C36A" />
    </svg>
  );
}

export function BakoorLogo({ compact = false, className = "", language = "ar" }) {
  return (
    <div className={`brand-lockup ${className}`} aria-label="بكور">
      <BakoorMark className="brand-mark" />
      {!compact && (
        <div className="brand-copy">
          <strong>بكور</strong>
          <span>{language === "ar" ? "خبير ترتيب يومك حول الصلاة" : "Prayer-centered day planning expert"}</span>
        </div>
      )}
    </div>
  );
}
