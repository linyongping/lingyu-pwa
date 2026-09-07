// icons.jsx — 统一线性图标（24 viewBox / stroke 1.7 / round caps）
const LY_ICON_PATHS = {
  clipboard: (
    <React.Fragment>
      <rect x="8" y="3" width="8" height="3.5" rx="1.2" />
      <path d="M9.5 5.2H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.2a2 2 0 0 0-2-2h-2.5" />
    </React.Fragment>
  ),
  translate: (
    <React.Fragment>
      <path d="M3.5 5.5h8.5" />
      <path d="M7.7 3.5v2" />
      <path d="M10 5.5c-.6 3.2-2.7 6.1-6 8" />
      <path d="M4.8 8.8c1 2.5 3 4.4 5.6 5.1" />
      <path d="M12.5 20.5 16.2 11l3.7 9.5" />
      <path d="M13.8 17.3h4.8" />
    </React.Fragment>
  ),
  spellcheck: (
    <React.Fragment>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.3 12.3 2.6 2.7 4.8-5.7" />
    </React.Fragment>
  ),
  wand: (
    <React.Fragment>
      <path d="m4 20 10.5-10.5" />
      <path d="m13 6 1.6 1.6" />
      <path d="m16.5 9.5 1.6 1.6" />
      <path d="M17.8 3.2v2.6" />
      <path d="M16.5 4.5h2.6" />
      <path d="M20.8 7.8v2.6" />
      <path d="M19.5 9.1h2.6" />
    </React.Fragment>
  ),
  copy: (
    <React.Fragment>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2.2" />
      <path d="M5 15.2V5.5A2.5 2.5 0 0 1 7.5 3h9.7" />
    </React.Fragment>
  ),
  check: <path d="m5 12.6 4.6 4.6L19 7.4" />,
  history: (
    <React.Fragment>
      <path d="M3.8 12a8.2 8.2 0 1 1 2.4 5.8" />
      <path d="M3.8 18.2v-4.4h4.4" />
      <path d="M12 7.8V12l3 1.9" />
    </React.Fragment>
  ),
  settings: (
    <React.Fragment>
      <path d="M4 7.5h9.5" />
      <circle cx="17" cy="7.5" r="2.4" />
      <path d="M20 7.5h.5" />
      <path d="M4 16.5h2.5" />
      <circle cx="10.5" cy="16.5" r="2.4" />
      <path d="M13.5 16.5H20" />
    </React.Fragment>
  ),
  sun: (
    <React.Fragment>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.8v2" />
      <path d="M12 19.2v2" />
      <path d="M2.8 12h2" />
      <path d="M19.2 12h2" />
      <path d="m5.5 5.5 1.4 1.4" />
      <path d="m17.1 17.1 1.4 1.4" />
      <path d="m18.5 5.5-1.4 1.4" />
      <path d="m6.9 17.1-1.4 1.4" />
    </React.Fragment>
  ),
  moon: <path d="M20.6 14.2A8.4 8.4 0 1 1 9.8 3.4a6.9 6.9 0 0 0 10.8 10.8Z" />,
  lock: (
    <React.Fragment>
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </React.Fragment>
  ),
  swap: (
    <React.Fragment>
      <path d="M8 20V7" />
      <path d="M8 7 5 10" />
      <path d="m8 7 3 3" />
      <path d="M16 4v13" />
      <path d="m16 17-3-3" />
      <path d="m16 17 3-3" />
    </React.Fragment>
  ),
  chevron: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  trash: (
    <React.Fragment>
      <path d="M4 7h16" />
      <path d="M9.5 7V5.2A1.7 1.7 0 0 1 11.2 3.5h1.6A1.7 1.7 0 0 1 14.5 5.2V7" />
      <path d="m6.5 7 .9 12.1A1.8 1.8 0 0 0 9.2 20.7h5.6a1.8 1.8 0 0 0 1.8-1.6L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </React.Fragment>
  ),
  rerun: (
    <React.Fragment>
      <path d="M20.5 5v4.5H16" />
      <path d="M20.3 9.3A8.5 8.5 0 1 0 21 12" />
    </React.Fragment>
  ),
  alert: (
    <React.Fragment>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17.2h.01" />
    </React.Fragment>
  ),
  zap: <path d="M13 2.5 4.5 13.5H10l-1 8 8.5-11H12l1-8Z" />,
  arrow: <path d="M4 12h15M14.5 6.5 20 12l-5.5 5.5" />,
  eye: (
    <React.Fragment>
      <path d="M2.8 12S6.4 5.8 12 5.8 21.2 12 21.2 12 17.6 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </React.Fragment>
  ),
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  clipboardPaste: (
    <React.Fragment>
      <rect x="8" y="3" width="8" height="3.5" rx="1.2" />
      <path d="M9.5 5.2H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.2a2 2 0 0 0-2-2h-2.5" />
      <path d="M9.5 12.5h5M9.5 16h3.5" />
    </React.Fragment>
  ),
  keyboard: (
    <React.Fragment>
      <rect x="2.5" y="6" width="19" height="12" rx="2.2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9.5 14h5" />
    </React.Fragment>
  ),
};

function LYIcon({ name, size = 18, className, strokeWidth = 1.7 }) {
  return (
    <svg
      className={"ly-icon" + (className ? " " + className : "")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {LY_ICON_PATHS[name]}
    </svg>
  );
}

Object.assign(window, { LYIcon });
