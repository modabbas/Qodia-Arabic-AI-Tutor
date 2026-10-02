export const arabicCount = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

export function shouldShowPrideMoment(count: number) {
  return Number.isInteger(count) && count > 0 && count % 5 === 0;
}
export function nextMilestoneDistance(count: number) {
  return (Math.floor(count / 5) + 1) * 5 - count;
}
export function anticipationDistance(completed: number) {
  if (!Number.isInteger(completed) || completed < 0) return null;
  const upcoming = completed + 1;
  const distance = nextMilestoneDistance(upcoming);
  return distance === 1 || distance === 2 ? distance : null;
}
export function milestoneLabel(count: number) {
  const labels: Record<number, string> = {
    5: 'صرت تكتب كود حقيقي 💪',
    10: 'عشر جلسات. هيك المطورين الحقيقيين بيبدأو',
    15: 'نص الطريق. مشروعك عم يصير حقيقة',
    20: 'عشرين جلسة. عم تبني بثقة، خطوة ورا خطوة',
    25: 'خمسة وعشرين جلسة. صرت تشرح كودك، مو بس تكتبه',
    30: 'ثلاثين جلسة. شوف الشغل اللي بنيته بإيدك',
  };
  return labels[count] ?? `${arabicCount(count)} جلسة. كل مرة عم تطوّر شغلك أكتر`;
}