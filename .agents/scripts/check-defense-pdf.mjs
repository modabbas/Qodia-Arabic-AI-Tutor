import { createRequire } from 'node:module';

// Synthetic layout fixture only; never use it as a student's assessment.
const { downloadDefensePdf } = createRequire(import.meta.url)('/tmp/kodia-defense-pdf.cjs');
const question = {
  professor: 'د. فاطمة', role: 'مُقيّم تقني', difficulty: 'intermediate',
  question_text: 'لماذا اخترت إدارة الحالة في ملف src/App.tsx، وكيف تتجنب تحديثات غير ضرورية عند تغير بيانات الرحلات؟',
  concept_tested: 'إدارة الحالة', file_reference: 'src/App.tsx', time_limit_seconds: 60,
  student_answer: 'أستخدم useState للاحتفاظ بالحالة المحلية وأمرر البيانات إلى المكونات عبر الخصائص. يساعد ذلك على فصل مسؤوليات العرض عن البيانات. أراجع الاعتماديات وأختبر حالات الفشل، ولا أفترض أن هذه المحاكاة تثبت نجاح تشغيل المشروع.',
  draft: '', answered_at: '2026-10-02T12:00:00Z', points: 80,
  time_used_seconds: 60, evaluation_status: 'scored',
  strengths: ['توضيح تدفق البيانات وفصل المسؤوليات.'],
  weaknesses: ['تحتاج أمثلة إضافية على الاختبارات.'],
  professor_reaction: 'إجابة منظمة، لكن يلزم توضيح أثر القرار على قابلية الاختبار.',
  mini_feedback: 'وضّح اختباراً عملياً لهذا القرار.', would_pass: true,
  ideal_answer_points: ['شرح دور الحالة.', 'تحديد مسؤولية المكوّن.', 'مناقشة مفاضلة مع بديل.'],
};
await downloadDefensePdf({
  id: 'sample00-0000-4000-8000-000000000000', status: 'completed', source: 'curated',
  project_name: 'فحص تنسيق التقرير — بيانات اختبار', tech_stack: 'React',
  questions: Array.from({ length: 5 }, (_, index) => ({ ...question, question_number: index + 1 })),
  current_index: 4, current_question_started_at: null, deadline_at: null,
  server_now: '2026-10-02T12:00:00Z', remaining_seconds: 0, overall_score: 80,
  verdict: 'هذا تقرير اختبار للتنسيق فقط، وليس تقييماً لطالب حقيقي.',
  weak_concepts: ['اختبار المكونات'], completed_at: '2026-10-02T12:00:00Z', answered_count: 5,
}, {
  project_name: 'فحص تنسيق التقرير', tech_stack: 'React', completed_concepts: 10, total_concepts: 30,
  average_mastery: 80, eligible: true, warning: null, no_saved_files: false, completed_files: 5,
  total_attempts: 1, best_score: 80, last_attempt_at: '2026-10-02T12:00:00Z', latest_active: null,
});