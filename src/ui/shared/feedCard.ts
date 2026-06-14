// Small shared DOM pieces for feed-style cards: the all-projects Feed cards (feedView) and
// the Weekly worklog reference suggestion cards (workLogDetailView) share the same project
// label, badge/date header, and content-preview paragraph structure. These are intentionally
// tiny building blocks, not a generic card component — each view still assembles its own card.

export type FeedCardVariant = "weekly" | "task" | "event";

const BADGE_LABELS: Record<FeedCardVariant, string> = {
  weekly: "Weekly",
  task: "Task",
  event: "Event",
};

// Weekly has no modifier class; Task/Event add their badge color modifier.
const BADGE_MODIFIER_CLASS: Record<FeedCardVariant, string> = {
  weekly: "",
  task: " task",
  event: " event",
};

export function createFeedProjectLabel(params: {
  projectColor: string;
  projectName: string;
  clientName: string;
}): HTMLParagraphElement {
  const label = document.createElement("p");
  label.className = "feed-card-project";

  const swatch = document.createElement("span");
  swatch.className = "project-swatch";
  swatch.style.setProperty("--project-color", params.projectColor);

  const name = document.createElement("span");
  name.className = "feed-card-project-name";
  name.textContent = params.clientName
    ? `${params.projectName} · ${params.clientName}`
    : params.projectName;

  label.append(swatch, name);
  return label;
}

export function createFeedCardHeader(variant: FeedCardVariant, dateText: string): HTMLDivElement {
  const header = document.createElement("div");
  header.className = "project-memo-card-header";

  const badge = document.createElement("span");
  badge.className = `project-memo-badge${BADGE_MODIFIER_CLASS[variant]}`;
  badge.textContent = BADGE_LABELS[variant];

  const date = document.createElement("span");
  date.className = "project-memo-date";
  date.textContent = dateText;

  header.append(badge, date);
  return header;
}

export function createFeedContentParagraph(text: string): HTMLParagraphElement {
  const content = document.createElement("p");
  content.className = "project-memo-content";
  content.textContent = text;
  return content;
}
