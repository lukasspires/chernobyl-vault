interface Props {
  name: string;
  onRemove?: () => void;
}

export function TagBadge({ name, onRemove }: Props) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
      {name}
      {onRemove ? (
        <button type="button" onClick={onRemove} className="hover:text-amber-950 dark:hover:text-amber-100">
          ×
        </button>
      ) : null}
    </span>
  );
}
