export function shuffledChunkOrder(count: number, random = Math.random): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  for (let index = count - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  if (count > 1 && order.every((value, index) => value === index)) order.push(order.shift()!);
  return order;
}

export function restoreTouch4Source(fullSource: string, fixed: string) {
  return fullSource.startsWith(fixed)
    ? { code: fullSource.slice(fixed.length), fullFile: false }
    : { code: fullSource, fullFile: true };
}

export function validChunkOrder(value: unknown, count: number): value is number[] {
  return count >= 3 && count <= 6 && Array.isArray(value) && value.length === count && new Set(value).size === count
    && value.every(index => Number.isInteger(index) && index >= 0 && index < count);
}