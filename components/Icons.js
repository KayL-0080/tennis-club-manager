// components/Icons.js
// Modern, crisp vector SVG icons for navigation and page headers (Apple SF Symbols style)

export function HomeIcon({ active = false, size = 22, color, className = '', style = {} }) {
  const strokeColor = color || (active ? 'var(--ios-blue, #007aff)' : 'currentColor');
  const fillColor = active ? (color || 'var(--ios-blue, #007aff)') : 'none';

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill={fillColor} 
      stroke={strokeColor} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M3 10.182V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9.818a2 2 0 0 0-.745-1.562l-7-5.444a2 2 0 0 0-2.51 0l-7 5.444A2 2 0 0 0 3 10.182Z" />
      <path 
        d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" 
        fill={active ? '#ffffff' : 'none'} 
        stroke={active ? '#ffffff' : strokeColor} 
        strokeWidth="1.8" 
      />
    </svg>
  );
}

export function StatsIcon({ active = false, size = 22, color, className = '', style = {} }) {
  const barColor = color || (active ? 'var(--ios-blue, #007aff)' : 'currentColor');

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill={barColor} 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <rect x="3.5" y="13" width="4" height="8" rx="2" />
      <rect x="10" y="8" width="4" height="13" rx="2" />
      <rect x="16.5" y="3" width="4" height="18" rx="2" />
    </svg>
  );
}

export function VoteIcon({ active = false, size = 22, color, className = '', style = {} }) {
  const strokeColor = color || (active ? 'var(--ios-blue, #007aff)' : 'currentColor');
  const bodyFill = active ? (color || 'var(--ios-blue, #007aff)') : 'none';
  const checkColor = active ? '#ffffff' : (color || 'var(--ios-blue, #007aff)');

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <rect 
        x="3" 
        y="4" 
        width="18" 
        height="17" 
        rx="3.5" 
        fill={bodyFill} 
        stroke={strokeColor} 
        strokeWidth="2" 
      />
      <line x1="8" y1="2" x2="8" y2="5" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="2" x2="16" y2="5" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="9" x2="21" y2="9" stroke={active ? '#ffffff' : strokeColor} strokeWidth="1.8" />
      <path 
        d="M8.5 14.5l2.5 2.5 5-5" 
        stroke={checkColor} 
        strokeWidth="2.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}

export function TrophyIcon({ active = false, size = 22, color, className = '', style = {} }) {
  const strokeColor = color || (active ? 'var(--ios-blue, #007aff)' : 'currentColor');
  const cupFill = active ? (color || 'var(--ios-blue, #007aff)') : 'none';

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={strokeColor} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path 
        d="M6 4h12v4.5c0 3.038-2.462 5.5-5.5 5.5h-1C8.462 14 6 11.538 6 8.5V4z" 
        fill={cupFill} 
      />
      <path d="M6 6H3.5A1.5 1.5 0 0 0 2 7.5v.5A4 4 0 0 0 6 12" />
      <path d="M18 6h2.5A1.5 1.5 0 0 1 22 7.5v.5A4 4 0 0 1 18 12" />
      <path d="M12 14v4" />
      <path d="M7 21h10" />
      <path d="M9 18h6" />
    </svg>
  );
}

export function MembersIcon({ active = false, size = 22, color, className = '', style = {} }) {
  const strokeColor = color || (active ? 'var(--ios-blue, #007aff)' : 'currentColor');
  const fillColor = active ? (color || 'var(--ios-blue, #007aff)') : 'none';

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={strokeColor} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill={fillColor} />
      <circle cx="8.5" cy="7" r="4" fill={fillColor} />
      <path d="M20 8c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5" />
      <path d="M23 21v-1.5a3.5 3.5 0 0 0-3-3.4" />
    </svg>
  );
}

export function ManualIcon({ active = false, size = 22, color, className = '', style = {} }) {
  const strokeColor = color || (active ? 'var(--ios-blue, #007aff)' : 'currentColor');
  const fillColor = active ? (color || 'var(--ios-blue, #007aff)') : 'none';

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={strokeColor} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" fill={fillColor} />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" fill={fillColor} />
    </svg>
  );
}

export function InstallIcon({ size = 16, color = 'currentColor', className = '', style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <path d="M12 7v6.5m0 0l-2.5-2.5M12 13.5l2.5-2.5" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  );
}

// ── Screen Header Icon Badge (각 메뉴 화면 상단 타이틀 옆에 표시되는 세련된 아이콘 뱃지) ──
export function PageHeaderIcon({ type, size = 24 }) {
  const configs = {
    dashboard: {
      Icon: HomeIcon,
      color: '#0284c7',
      bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
      shadow: '0 4px 12px rgba(2, 132, 199, 0.15)'
    },
    stats: {
      Icon: StatsIcon,
      color: '#2563eb',
      bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
      shadow: '0 4px 12px rgba(37, 99, 235, 0.15)'
    },
    votes: {
      Icon: VoteIcon,
      color: '#059669',
      bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
      shadow: '0 4px 12px rgba(5, 150, 105, 0.15)'
    },
    tournaments: {
      Icon: TrophyIcon,
      color: '#d97706',
      bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      shadow: '0 4px 12px rgba(217, 119, 6, 0.15)'
    },
    members: {
      Icon: MembersIcon,
      color: '#7c3aed',
      bg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
      shadow: '0 4px 12px rgba(124, 58, 237, 0.15)'
    },
    manual: {
      Icon: ManualIcon,
      color: '#0284c7',
      bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
      shadow: '0 4px 12px rgba(2, 132, 199, 0.15)'
    }
  };

  const cfg = configs[type] || configs.dashboard;
  const { Icon, color, bg, shadow } = cfg;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '38px',
        height: '38px',
        borderRadius: '12px',
        background: bg,
        boxShadow: shadow,
        marginRight: '10px',
        flexShrink: 0,
        verticalAlign: 'middle'
      }}
    >
      <Icon active size={size} color={color} />
    </span>
  );
}

// ── Action Toolbar Icons ──
export function UserPlusIcon({ size = 18, color = 'currentColor', className = '', style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="17" y1="11" x2="23" y2="11" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 18, color = '#15803d', className = '', style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function RefreshIcon({ size = 18, color = '#dc2626', className = '', style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  );
}

export function NoticeIcon({ size = 18, color = '#2563eb', className = '', style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="13" y2="13" />
    </svg>
  );
}

export function LockIcon({ size = 15, color = 'currentColor', className = '', style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2.5" ry="2.5" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function LogoutIcon({ size = 15, color = 'currentColor', className = '', style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}



