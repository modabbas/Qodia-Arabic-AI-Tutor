import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BellRing, Check, X } from 'lucide-react';
import { useCreateStoreInterest, type StoreProject } from '@workspace/api-client-react';
import { errorMessage, errorStatus } from './store-utils';

type Kind = 'student' | 'institute';
type Errors = Partial<Record<'name' | 'contact' | 'note', string>>;
type Outcome = { tone: 'ok' | 'dup'; text: string } | null;

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^\+?[\d\s().-]+$/;

function validate(name: string, contact: string, note: string): Errors {
  const e: Errors = {};
  const n = name.trim();
  if (n.length < 2) e.name = 'اكتب اسمك (حرفان على الأقل).';
  else if (n.length > 100) e.name = 'الاسم أطول من ١٠٠ حرف.';
  const c = contact.normalize('NFKC').trim().replace(/[٠-٩۰-۹]/g, char => {
    const code = char.charCodeAt(0);
    return String(code >= 0x6f0 ? code - 0x6f0 : code - 0x660);
  });
  const digits = c.replace(/\D/g, '').replace(/^00/, '');
  if (!c) e.contact = 'نحتاج بريدًا أو رقم هاتف لنبلغك.';
  else if (c.length > 200 || !(emailRe.test(c) || (phoneRe.test(c) && digits.length >= 7 && digits.length <= 15))) e.contact = 'اكتب بريدًا إلكترونيًا صحيحًا أو رقم هاتف من ٧ إلى ١٥ رقمًا.';
  if (note.length > 1000) e.note = 'الملاحظة أطول من ١٠٠٠ حرف.';
  return e;
}

export function InterestPanel({ project }: { project: StoreProject }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [kind, setKind] = useState<Kind>('student');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const mutation = useCreateStoreInterest();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const outcomeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (open) nameRef.current?.focus(); }, [open]);
  useEffect(() => { if (outcome) outcomeRef.current?.focus(); }, [outcome]);

  const close = () => { setOpen(false); setErrors({}); setServerError(null); requestAnimationFrame(() => triggerRef.current?.focus()); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mutation.isPending) return;
    const found = validate(name, contact, note);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) {
      const first = found.name ? 'interest-name' : found.contact ? 'interest-contact' : 'interest-note';
      document.getElementById(first)?.focus();
      return;
    }
    mutation.mutate(
      { id: project.id, data: { name: name.trim(), email_or_phone: contact.trim(), type: kind, note: note.trim() || undefined } },
      {
        onSuccess: (res) => { setOpen(false); setOutcome({ tone: 'ok', text: res?.message || 'سجّلنا اهتمامك. سنبلغك عند توفر المشروع.' }); },
        onError: (err) => {
          const status = errorStatus(err);
          if (status === 409) { setOpen(false); setOutcome({ tone: 'dup', text: 'هذا التواصل مسجّل مسبقًا لهذا المشروع — لا حاجة للتسجيل مرة ثانية، سنبلغك عند التوفر.' }); return; }
          if (status === 429) { setServerError('محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.'); return; }
          if (status === 400) { setServerError(errorMessage(err) || 'تحقق من البيانات المدخلة وحاول مجددًا.'); return; }
          setServerError('تعذّر إرسال الطلب الآن. تأكد من اتصالك وحاول مرة ثانية.');
        },
      },
    );
  };

  if (outcome) {
    return (
      <div ref={outcomeRef} tabIndex={-1} className={`st-outcome st-outcome-${outcome.tone}`} role="status" aria-live="polite" data-testid="status-interest-result">
        <Check size={18} aria-hidden="true" />
        <div><strong>{outcome.tone === 'ok' ? 'تم التسجيل.' : 'مسجّل من قبل.'}</strong><p>{outcome.text}</p><small>لن نطلب منك أي دفع الآن — هذه المرحلة لتسجيل الاهتمام فقط.</small></div>
      </div>
    );
  }

  return (
    <div className="st-interest">
      {!open && (
        <button ref={triggerRef} type="button" className="qp-button" aria-expanded={false} aria-controls="interest-form" onClick={() => setOpen(true)} data-testid="button-notify">
          <BellRing size={17} aria-hidden="true" /> أبلغني عند التوفر
        </button>
      )}
      {open && (
        <form id="interest-form" className="st-form" onSubmit={submit} noValidate aria-labelledby="interest-title" onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
          <div className="st-form-head">
            <h3 id="interest-title">أبلغني عند توفر «{project.title_ar}»</h3>
            <button type="button" className="st-icon-btn" onClick={close} aria-label="إغلاق النموذج" data-testid="button-close-interest"><X size={17} /></button>
          </div>
          <div className="st-field">
            <label className="field-label" htmlFor="interest-name">الاسم</label>
            <input ref={nameRef} id="interest-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'err-name' : undefined} data-testid="input-name" />
            {errors.name && <p id="err-name" className="st-err">{errors.name}</p>}
          </div>
          <div className="st-field">
            <label className="field-label" htmlFor="interest-contact">البريد الإلكتروني أو رقم الهاتف</label>
            <input id="interest-contact" className="field" dir="ltr" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} autoComplete="email" aria-invalid={!!errors.contact} aria-describedby={errors.contact ? 'err-contact' : undefined} data-testid="input-contact" />
            {errors.contact && <p id="err-contact" className="st-err">{errors.contact}</p>}
          </div>
          <fieldset className="st-field st-radios">
            <legend className="field-label">أنت</legend>
            {(['student', 'institute'] as const).map((value) => (
              <label key={value} className={`st-radio${kind === value ? ' is-on' : ''}`}>
                <input type="radio" name="interest-type" value={value} checked={kind === value} onChange={() => setKind(value)} data-testid={`radio-type-${value}`} />
                {value === 'student' ? 'طالب' : 'معهد / جهة تعليمية'}
              </label>
            ))}
          </fieldset>
          <div className="st-field">
            <label className="field-label" htmlFor="interest-note">ملاحظة <span className="st-opt">(اختياري)</span></label>
            <textarea id="interest-note" className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} aria-invalid={!!errors.note} aria-describedby={errors.note ? 'err-note' : 'note-count'} data-testid="input-note" />
            <p id="note-count" className="st-count">{note.length} / 1000</p>
            {errors.note && <p id="err-note" className="st-err">{errors.note}</p>}
          </div>
          {serverError && <p className="error-note" role="alert" data-testid="status-interest-error">{serverError}</p>}
          <div className="st-form-actions">
            <button type="submit" className="qp-button" disabled={mutation.isPending} data-testid="button-submit-interest">{mutation.isPending ? 'نرسل…' : 'سجّل اهتمامي'}</button>
            <button type="button" className="qp-button qp-button-quiet" onClick={close} data-testid="button-cancel-interest">إلغاء</button>
          </div>
          <p className="st-form-note">لا دفع ولا بيانات بطاقة. نستخدم تواصلك فقط لإبلاغك عن هذا المشروع.</p>
        </form>
      )}
    </div>
  );
}
