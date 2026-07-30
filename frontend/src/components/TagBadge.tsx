interface Props {
  name: string;
  onRemove?: () => void;
}

export function TagBadge({ name, onRemove }: Props) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
      {name}
      {onRemove ? (
        <button type="button" onClick={onRemove} className="hover:text-violet-900 dark:hover:text-violet-100">
          ×
        </button>
      ) : null}
    </span>
  );
}
