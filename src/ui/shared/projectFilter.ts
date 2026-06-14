import type { Project } from "../../types";

// Shared project checkbox filter list used by the Calendar and Feed settings panels. Each
// caller supplies its own list container and "select/clear all" button; the selection is a
// shared Set the checkbox change mutates in place before invoking the change callback.
//
// The Ledger project filter is intentionally not routed through this helper: it toggles
// per-project `hideFromLedger` visibility instead of a selected-id Set, so sharing it here
// would complicate the helper.

export type ProjectFilterElements = {
  container: HTMLElement;
  toggleAllButton: HTMLElement;
};

export function renderProjectCheckboxFilter(
  elements: ProjectFilterElements,
  projects: Project[],
  selectedProjectIds: Set<string>,
  onSelectedProjectIdsChange: (selectedProjectIds: Set<string>) => void,
): void {
  const { container, toggleAllButton } = elements;
  container.innerHTML = "";

  projects.forEach((project) => {
    const label = document.createElement("label");
    label.className = "calendar-filter-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedProjectIds.has(project.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedProjectIds.add(project.id);
      } else {
        selectedProjectIds.delete(project.id);
      }
      onSelectedProjectIdsChange(selectedProjectIds);
    });

    const swatch = document.createElement("span");
    swatch.className = "project-swatch";
    swatch.style.setProperty("--project-color", project.color);

    const name = document.createElement("span");
    name.textContent = project.name;

    label.append(checkbox, swatch, name);
    container.append(label);
  });

  const allSelected = projects.length > 0 && selectedProjectIds.size === projects.length;
  toggleAllButton.textContent = allSelected ? "Clear all" : "Select all";
}
