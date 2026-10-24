import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: false,
};

export const SearchIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const XIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const StarIcon = ({ filled = false, ...props }: IconProps & { filled?: boolean }) => (
  <svg {...base} {...props} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8L12 3.6z" />
  </svg>
);

export const DownloadIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3v12" />
    <path d="m7.5 11 4.5 4 4.5-4" />
    <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </svg>
);

export const CopyIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M5 12h14" />
  </svg>
);

export const SunIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" />
  </svg>
);

export const MenuIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const GithubIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7m12 5.2v-3.6a3.1 3.1 0 0 0-.9-2.4c3-.3 6.2-1.5 6.2-6.7A5.2 5.2 0 0 0 18.9 5a4.9 4.9 0 0 0-.1-3.6s-1.1-.3-3.6 1.4a12.3 12.3 0 0 0-6.4 0C6.3 1.1 5.2 1.4 5.2 1.4A4.9 4.9 0 0 0 5 5a5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.2 6.4 6.2 6.7a3.1 3.1 0 0 0-.9 2.4V22" />
  </svg>
);

export const ExternalIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5" />
  </svg>
);

export const LayersIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);

export const ConvertIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 8h13a3 3 0 0 1 3 3v1" />
    <path d="m17 4 3 4-3 4" />
    <path d="M20 16H7a3 3 0 0 1-3-3v-1" />
    <path d="m7 20-3-4 3-4" />
  </svg>
);

export const ShieldIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3 5 6v6c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const CodeIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m8 6-5 6 5 6M16 6l5 6-5 6" />
  </svg>
);

export const BookIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z" />
  </svg>
);

export const InfoIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

export const AlertIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 4 3 19h18L12 4Z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);

export const AlertCircleIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16h.01" />
  </svg>
);

export const TrashIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const ArchiveIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M10 12h4" />
  </svg>
);

export const FileIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const UploadIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 21V9" />
    <path d="m7.5 13 4.5-4 4.5 4" />
    <path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V7" />
  </svg>
);

export const ImageIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="9.5" r="1.5" />
    <path d="m4 18 5.5-5.5 4 4L17 13l3 3" />
  </svg>
);

export const ArrowRightIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ArrowUpRightIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

export const ChevronDownIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const FilterIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

export const GridIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);

export const SpinnerIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...props} aria-hidden focusable="false">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.22" />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
    </path>
  </svg>
);
