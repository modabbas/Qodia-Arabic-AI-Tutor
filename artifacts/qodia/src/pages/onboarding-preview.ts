import type { TechStack } from '@workspace/api-client-react';

const description = 'خمس لمسات بينك وبين جواب أوضح';
const previews: Record<TechStack, { title: string; description: string }> = {
  React: { title: 'useState وإدارة الحالة في React', description },
  Flutter: { title: 'StatefulWidget و دورة حياة الـ Widget في Flutter', description },
  Django: { title: 'ForeignKey و on_delete في Django', description },
  'Node.js': { title: 'Routes و معالجة الطلبات في Node.js', description },
};

export function firstChallengePreview(stack: string) {
  return Object.hasOwn(previews, stack)
    ? previews[stack as TechStack]
    : { title: 'اختر التقنية لتشوف معاينة أول تحدّي', description };
}