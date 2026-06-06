// Lightweight, self-contained toast notifications shown at the bottom of the window.
type ToastVariant = "success" | "error";

const TOAST_DURATION_MS = 4000;

let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (container) {
    return container;
  }

  const element = document.createElement("div");
  element.className = "toast-container";
  document.body.append(element);
  container = element;
  return element;
}

export function showToast(message: string, variant: ToastVariant = "success"): void {
  const toast = document.createElement("div");
  toast.className = `toast toast-${variant}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;

  const host = getContainer();
  host.append(toast);

  // Trigger the enter transition on the next frame.
  window.requestAnimationFrame(() => toast.classList.add("toast-visible"));

  const remove = (): void => {
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  };

  window.setTimeout(remove, TOAST_DURATION_MS);
  toast.addEventListener("click", remove);
}
