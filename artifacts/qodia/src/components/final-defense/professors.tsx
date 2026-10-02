import { useId } from 'react';

export type ProfessorKey = 'hassan' | 'fatima' | 'ahmed';

export const PROFESSORS: Record<ProfessorKey, { name: string; role: string; from: string; to: string }> = {
  hassan: { name: 'د. حسن', role: 'رئيس اللجنة', from: '#7c5cc4', to: '#2e2150' },
  fatima: { name: 'د. فاطمة', role: 'مُقيّم تقني', from: '#2fb3a3', to: '#0f3b3a' },
  ahmed: { name: 'د. أحمد', role: 'المشرف', from: '#e0a24a', to: '#4a3010' },
};

export function professorKey(name: string): ProfessorKey {
  if (name.includes('فاطمة')) return 'fatima';
  if (name.includes('أحمد') || name.includes('احمد')) return 'ahmed';
  return 'hassan';
}

export function ProfessorAvatar({ who, size = 84 }: { who: ProfessorKey; size?: number }) {
  const id = useId().replace(/:/g, '');
  const p = PROFESSORS[who];
  const skin = who === 'fatima' ? '#e3b48f' : who === 'ahmed' ? '#d9a679' : '#e8bd98';
  return <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${p.name}، ${p.role}`} className="fd-avatar-svg">
    <defs><linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={p.from} /><stop offset="1" stopColor={p.to} /></linearGradient><clipPath id={`c${id}`}><circle cx="50" cy="50" r="48" /></clipPath></defs>
    <circle cx="50" cy="50" r="48" fill={`url(#g${id})`} />
    <g clipPath={`url(#c${id})`}>
      <path d="M12 104c2-22 16-31 38-31s36 9 38 31z" fill={who === 'hassan' ? '#1b1b22' : who === 'fatima' ? '#26323a' : '#3a2a1a'} />
      <path d="M42 73l8 12 8-12z" fill="#eae9e1" />
      {who === 'fatima' ? <>
        <path d="M24 56c0-24 11-36 26-36s26 12 26 36c0 14-6 26-26 26S24 70 24 56z" fill="#e9e4d6" />
        <ellipse cx="50" cy="52" rx="17" ry="20" fill={skin} />
      </> : <>
        <ellipse cx="50" cy="50" rx="19" ry="23" fill={skin} />
        {who === 'hassan' ? <>
          <path d="M30 44c-2-18 8-26 20-26s22 8 20 26c-4-9-10-13-20-13s-16 4-20 13z" fill="#c9c6bd" />
          <path d="M32 56c2 16 10 22 18 22s16-6 18-22c-4 8-10 11-18 11s-14-3-18-11z" fill="#c9c6bd" />
        </> : <path d="M31 46c-3-18 7-27 19-27s22 9 19 27c-3-8-9-12-19-12s-16 4-19 12z" fill="#2b1d12" />}
      </>}
      <circle cx="43" cy="52" r="2" fill="#1a1410" /><circle cx="57" cy="52" r="2" fill="#1a1410" />
      <path d="M44 62q6 4 12 0" stroke="#7a4a35" strokeWidth="2" fill="none" strokeLinecap="round" />
      {who !== 'hassan' && <g stroke="#1a1410" strokeWidth="1.6" fill="none"><rect x="36" y="46" width="12" height="9" rx="3" /><rect x="52" y="46" width="12" height="9" rx="3" /><path d="M48 50h4" /></g>}
    </g>
  </svg>;
}

export function ProfessorPanel({ active, reveal = false, compact = false }: { active?: ProfessorKey; reveal?: boolean; compact?: boolean }) {
  return <div className={`fd-panel-row${compact ? ' compact' : ''}`} data-testid="panel-professors">
    {(Object.keys(PROFESSORS) as ProfessorKey[]).map((k, i) => <div key={k} className={`fd-prof${active === k ? ' active' : ''}${reveal ? ' reveal' : ''}`} style={{ animationDelay: `${i * 220}ms`, ['--pc' as string]: PROFESSORS[k].from }} data-testid={`card-professor-${k}`}>
      <ProfessorAvatar who={k} size={compact ? 46 : 92} />
      <div className="fd-prof-text"><strong>{PROFESSORS[k].name}</strong><span>{PROFESSORS[k].role}</span></div>
    </div>)}
  </div>;
}
