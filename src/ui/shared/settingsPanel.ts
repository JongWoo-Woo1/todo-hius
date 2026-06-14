// Shared open/close rendering for the slide-in settings panels (Calendar, Feed, Ledger).
// Keeps the panel visibility, ARIA state, and button/close/backdrop click wiring in one
// place so each view only supplies its own elements.

export type SettingsPanelElements = {
  panel: HTMLElement;
  backdrop: HTMLElement;
  toggleButton: HTMLElement;
  closeButton: HTMLElement;
};

export function renderSettingsPanel(
  elements: SettingsPanelElements,
  isOpen: boolean,
  onToggleSettings: (open: boolean) => void,
): void {
  const { panel, backdrop, toggleButton, closeButton } = elements;

  panel.hidden = !isOpen;
  panel.setAttribute("aria-hidden", String(!isOpen));
  panel.classList.toggle("is-open", isOpen);
  backdrop.hidden = !isOpen;
  toggleButton.setAttribute("aria-expanded", String(isOpen));

  toggleButton.onclick = () => onToggleSettings(!isOpen);
  closeButton.onclick = () => onToggleSettings(false);
  backdrop.onclick = () => onToggleSettings(false);
}
