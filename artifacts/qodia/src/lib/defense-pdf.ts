import type { DefenseSimulation, DefenseSummary } from '@workspace/api-client-react';
import arabicFontUrl from '../assets/fonts/IBMPlexSansArabic-Regular.ttf?url';

let fontPromise: Promise<string> | undefined;

function getArabicFont(): Promise<string> {
  if (!fontPromise) {
    fontPromise = fetch(arabicFontUrl).then(async response => {
      if (!response.ok) throw new Error('تعذّر تحميل خط التقرير.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const chunks: string[] = [];
      for (let i = 0; i < bytes.length; i += 8192) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
      }
      return btoa(chunks.join(''));
    }).catch(error => {
      fontPromise = undefined;
      throw error;
    });
  }
  return fontPromise;
}

const ar = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

/** Creates a real, self-contained PDF from the authenticated, completed report. */
export async function downloadDefensePdf(simulation: DefenseSimulation, summary: DefenseSummary): Promise<void> {
  if (simulation.status !== 'completed' || simulation.overall_score === null) {
    throw new Error('أكمل الأسئلة الخمسة وتقييمها قبل تحميل التقرير.');
  }
  const [{ jsPDF }, font] = await Promise.all([import('jspdf'), getArabicFont()]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.addFileToVFS('KodiaArabic.ttf', font);
  pdf.addFont('KodiaArabic.ttf', 'KodiaArabic', 'normal');
  pdf.setFont('KodiaArabic');
  pdf.setProperties({ title: 'كوديا — تقرير محاكاة المناقشة النهائية', author: 'KODIA', subject: 'تقييم تدريبي بواسطة لجنة افتراضية' });
  const margin = 16;
  const width = 210 - margin * 2;
  const bottom = 274;
  let y = 22;

  const line = (text: string, size = 11, color: [number, number, number] = [40, 40, 40]) => {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const paragraphs = text.replace(/\r/g, '').split('\n');
    for (const paragraph of paragraphs) {
      const lines = pdf.splitTextToSize(paragraph || ' ', width) as string[];
      for (const part of lines) {
        const rtl = /[\u0600-\u06ff]/u.test(part);
        if (y + 7 > bottom) { pdf.addPage(); y = 22; }
        // jsPDF's bidi engine orders logical Arabic itself. setR2L(true)
        // would reverse that output again, including Latin file paths.
        pdf.setR2L(false);
        pdf.text(part, rtl ? 210 - margin : margin, y, {
          align: rtl ? 'right' : 'left',
          isInputVisual: false,
          isOutputVisual: true,
          isInputRtl: rtl,
          isOutputRtl: false,
        });
        y += size * 0.48 + 1.5;
      }
    }
    y += 3;
  };
  const section = (title: string) => {
    if (y + 24 > bottom) { pdf.addPage(); y = 22; }
    y += 4;
    line(title, 15, [20, 100, 62]);
  };

  line('كوديا — تقرير محاكاة المناقشة النهائية', 19, [20, 100, 62]);
  line('لجنة افتراضية — تدريب على الدفاع عن المشروع، وليس قراراً أكاديمياً أو شهادة اعتماد.', 10);
  line(`المشروع: ${simulation.project_name}`);
  line(`التقنية: ${simulation.tech_stack}`);
  line(`تاريخ إتمام المحاكاة: ${simulation.completed_at ? new Date(simulation.completed_at).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }) : 'غير مسجّل'}`);
  line(`الدرجة التقديرية: ${ar(simulation.overall_score)} من ١٠٠`);
  line(`الأسئلة المجتازة: ${ar(simulation.questions.filter(question => question.would_pass === true).length)} من ٥`);
  line(`مصدر الأسئلة: ${simulation.source === 'gemini' ? 'مولّدة بالذكاء الاصطناعي وفق ملفات المشروع' : 'بنك أسئلة احتياطي مرتبط بملفات المشروع'}`);
  line(`المفاهيم المكتملة عند إنشاء التقرير: ${ar(summary.completed_concepts)} من ${ar(summary.total_concepts)}`);
  section('رأي اللجنة');
  line(simulation.verdict ?? 'لا يوجد رأي ختامي مسجّل.');
  section('المفاهيم التي تحتاج مراجعة');
  if (simulation.weak_concepts.length) simulation.weak_concepts.forEach(concept => line(`• ${concept}`));
  else line('لم تُحدَّد مفاهيم ضعيفة في هذه المحاكاة.');

  for (const question of simulation.questions) {
    section(`السؤال ${ar(question.question_number)} — ${question.professor}`);
    line(`المفهوم: ${question.concept_tested}`);
    line(`الملف: ${question.file_reference}`);
    line(question.question_text, 12);
    line(`الدرجة: ${question.points === null ? 'لم يُقيَّم' : `${ar(question.points)} من ١٠٠`} — ${question.would_pass ? 'اجتاز' : 'لم يجتز'}`);
    line(`الوقت المستخدم: ${ar(question.time_used_seconds ?? 0)} ثانية من ٦٠. لا يُخصم رصيد لمجرد استخدام الوقت كاملاً.`, 10);
    line('إجابة الطالب:', 12);
    line(question.student_answer?.trim() || 'لم تُسجَّل إجابة.');
    line('رد اللجنة:', 12);
    line(question.professor_reaction ?? question.mini_feedback ?? 'لا يوجد رد مسجّل.');
    line('نقاط القوة:', 12);
    question.strengths.length ? question.strengths.forEach(point => line(`• ${point}`)) : line('لا توجد نقاط قوة مسجّلة.');
    line('نقاط التحسين:', 12);
    question.weaknesses.length ? question.weaknesses.forEach(point => line(`• ${point}`)) : line('لا توجد نقاط تحسين مسجّلة.');
    line('نقاط الإجابة المتوقعة:', 12);
    question.ideal_answer_points.forEach(point => line(`• ${point}`));
  }
  section('حدود التقرير');
  line('هذه النتيجة تقدير تدريبي لإجابات الطالب في المحاكاة فقط. لا تضمن النجاح في المناقشة الحقيقية، ولا تثبت اجتياز المشروع لاختبارات التشغيل أو البناء الكامل.', 10);
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(210, 210, 210);
    pdf.line(margin, 281, 210 - margin, 281);
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.setR2L(false);
    pdf.text(`KODIA  |  ${page} / ${pages}`, 105, 287, { align: 'center' });
  }
  const date = (simulation.completed_at ?? new Date().toISOString()).slice(0, 10);
  pdf.save(`kodia-defense-${date}-${simulation.id.slice(0, 8)}.pdf`);
}