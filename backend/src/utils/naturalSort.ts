export function naturalCompare(a: string, b: string): number {
  const re = /(\d+|\D+)/g;
  const aParts = a.match(re) ?? [a];
  const bParts = b.match(re) ?? [b];
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const aPart = aParts[i] ?? '';
    const bPart = bParts[i] ?? '';
    const aNum = Number(aPart);
    const bNum = Number(bPart);
    const aIsNum = aPart !== '' && !Number.isNaN(aNum);
    const bIsNum = bPart !== '' && !Number.isNaN(bNum);

    if (aIsNum && bIsNum) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      const cmp = aPart.localeCompare(bPart, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }

  return 0;
}

export function sortNaturally<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => naturalCompare(key(a), key(b)));
}
