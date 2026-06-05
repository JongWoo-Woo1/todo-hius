export function getDetailValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

export function createDetailRow(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "todo-detail-row";

  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;

  row.append(term, description);
  return row;
}
