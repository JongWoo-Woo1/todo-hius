import {
  confirmDialog,
  confirmDialogAcceptButton,
  confirmDialogCancelButton,
  confirmDialogMessage,
} from "./dom";

// In-app confirmation dialog for destructive actions.
// Returns a promise that resolves to true when confirmed, false when cancelled.
let activeResolve: ((confirmed: boolean) => void) | null = null;

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    close(false);
  }
}

function close(confirmed: boolean): void {
  if (!activeResolve) {
    return;
  }

  const resolve = activeResolve;
  activeResolve = null;
  confirmDialog.hidden = true;
  document.removeEventListener("keydown", onKeydown);
  resolve(confirmed);
}

confirmDialogAcceptButton.addEventListener("click", () => close(true));
confirmDialogCancelButton.addEventListener("click", () => close(false));
confirmDialog.addEventListener("click", (event) => {
  if (event.target === confirmDialog) {
    close(false);
  }
});

export function confirmDelete(message: string): Promise<boolean> {
  // Resolve any dialog left open as cancelled before opening a new one.
  close(false);

  confirmDialogMessage.textContent = message;
  confirmDialog.hidden = false;
  document.addEventListener("keydown", onKeydown);
  confirmDialogAcceptButton.focus();

  return new Promise<boolean>((resolve) => {
    activeResolve = resolve;
  });
}
