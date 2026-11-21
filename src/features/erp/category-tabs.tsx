import { Button } from "./ui";

export function CategoryTabs({
  labels,
  value,
  onChange,
  counts,
}: {
  labels: string[];
  value: string;
  onChange: (value: string) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="tabs-line" role="tablist" aria-label="Record categories">
      {labels.map((label) => (
        <Button
          key={label}
          variant="ghost"
          role="tab"
          aria-selected={value === label}
          className={value === label ? "selected" : ""}
          onClick={() => onChange(label)}
        >
          {label}
          {counts && <span className="category-count">{counts[label] ?? 0}</span>}
        </Button>
      ))}
    </div>
  );
}
