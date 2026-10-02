import { useEffect, useState, type ReactNode } from 'react';
import type { CodeDiffResult } from '@workspace/api-client-react';
import { liveSyntaxIssues, type LiveSyntaxIssue } from './touch4-live-syntax';
import s from './Touch4Feedback.module.css';

export function Touch4CodeMirror({ code, file, completed, highlight, lockedPrefix = '' }: {
  code: string; file: string; completed: boolean; highlight: (value: string) => ReactNode; lockedPrefix?: string;
}) {
  const [issues, setIssues] = useState<LiveSyntaxIssue[]>([]);
  useEffect(() => {
    setIssues([]);
    if (completed || (lockedPrefix && code === lockedPrefix)) return;
    const timer = window.setTimeout(() => setIssues(liveSyntaxIssues(code, file)), 500);
    return () => window.clearTimeout(timer);
  }, [code, file, completed, lockedPrefix]);
  const lines = code.split('\n');
  let offset = 0;
  return <code data-testid="touch4-live-mirror">{lines.map((line, index) => {
    const locked = Math.max(0, Math.min(line.length, lockedPrefix.length - offset));
    offset += line.length + 1;
    const issue = issues.find(item => item.lineNumber === index + 1);
    return <span key={index} className={issue ? s.liveError : completed ? s.liveGood : undefined}
      data-line-number={index + 1} data-syntax-issue={issue ? 'true' : undefined}
      title={issue?.hint}>{locked > 0 ? <><span className={s.lockedPrefix} data-testid="code-locked-prefix">{highlight(line.slice(0, locked))}</span>{highlight(line.slice(locked))}</> : highlight(line) || ' '}{index < lines.length - 1 ? '\n' : ''}</span>;
  })}</code>;
}

export function Touch4DiffFeedback({ diff }: { diff: CodeDiffResult }) {
  return <section className={s.diff} aria-label="مراجعة أسطر الكود" data-testid="touch4-code-diff">
    <h4>راجع هالأسطر:</h4>
    <p className={s.note}>مقارنة مساعدة، مو شرط تكتب نفس الحل حرفياً. فحص الصياغة والبنية هو اللي يحدد الخطأ.</p>
    <ol>
      {diff.lines.map((line, index) => <li key={index} className={`${s.line} ${s[line.status]}`}
        data-line-number={line.lineNumber} data-diff-status={line.status}>
        <div className={s.source}><span className={s.number}>{line.lineNumber.toLocaleString('ar-EG')}</span>
          <code>{line.status === 'missing' ? '…' : line.studentContent || ' '}</code>
          <span className={s.label} dir="rtl">{line.status === 'match' ? 'مطابق' : line.status === 'missing' ? 'ناقص هون' : line.status === 'extra' ? 'سطر إضافي' : 'راجع السطر'}</span>
        </div>
        {line.hint && <p>{line.hint}</p>}
      </li>)}
    </ol>
    {diff.truncated && <p className={s.note}>عرضنا أول مواضع الاختلاف فقط مع سطر الخطأ. أصلحها ثم جرّب مجدداً.</p>}
  </section>;
}