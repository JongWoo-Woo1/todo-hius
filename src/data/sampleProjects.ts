import type { AppState, Project } from "../types";
import { toDateKey } from "../utils/calendar";

function getOffsetDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return toDateKey(date);
}

export function createSampleState(): AppState {
  const projects: Project[] = [
    {
      id: "project-veristand",
      name: "veristand",
      color: "#2563eb",
      todos: [
        {
          id: "todo-veristand-1",
          title: "Review signal mapping",
          dueDate: getOffsetDate(1),
          memo: "Check I/O naming and unresolved channels before the next integration run.",
          completed: false,
        },
        {
          id: "todo-veristand-2",
          title: "Validate fault injection scenario",
          dueDate: getOffsetDate(4),
          memo: "Confirm expected alarm behavior with the latest system definition.",
          completed: false,
        },
        {
          id: "todo-veristand-3",
          title: "Archive previous test report",
          dueDate: null,
          memo: "Keep the approved report with the release notes.",
          completed: true,
        },
      ],
    },
    {
      id: "project-labview",
      name: "labview",
      color: "#16a34a",
      todos: [
        {
          id: "todo-labview-1",
          title: "Refactor acquisition loop",
          dueDate: getOffsetDate(2),
          memo: "Reduce duplicated timing logic and isolate file logging.",
          completed: false,
        },
        {
          id: "todo-labview-2",
          title: "Check UI scaling on operator PC",
          dueDate: getOffsetDate(6),
          memo: "Verify the front panel at the target Windows display scale.",
          completed: false,
        },
      ],
    },
    {
      id: "project-ksoe-ai-ship",
      name: "ksoe_AI 선박",
      color: "#f97316",
      todos: [
        {
          id: "todo-ksoe-ai-1",
          title: "Review voyage dataset labels",
          dueDate: getOffsetDate(0),
          memo: "Spot-check route labels and abnormal operating segments.",
          completed: false,
        },
        {
          id: "todo-ksoe-ai-2",
          title: "Prepare model evaluation summary",
          dueDate: getOffsetDate(5),
          memo: "Include precision, recall, and failure examples for discussion.",
          completed: false,
        },
      ],
    },
    {
      id: "project-gmb-water-pump-hils",
      name: "gmb_water pump hils",
      color: "#9333ea",
      todos: [
        {
          id: "todo-gmb-1",
          title: "Tune pump startup profile",
          dueDate: getOffsetDate(3),
          memo: "Compare overshoot before and after the controller parameter update.",
          completed: false,
        },
        {
          id: "todo-gmb-2",
          title: "Run sensor dropout test",
          dueDate: getOffsetDate(8),
          memo: "Record fallback response and recovery time.",
          completed: false,
        },
      ],
    },
    {
      id: "project-ksoe-sofc",
      name: "ksoe_sofc",
      color: "#dc2626",
      todos: [
        {
          id: "todo-sofc-1",
          title: "Confirm stack temperature thresholds",
          dueDate: getOffsetDate(1),
          memo: "Cross-check with the latest control specification.",
          completed: false,
        },
        {
          id: "todo-sofc-2",
          title: "Summarize endurance test results",
          dueDate: getOffsetDate(7),
          memo: "Prepare charts for voltage drift and fuel utilization.",
          completed: false,
        },
      ],
    },
  ];

  return {
    projects,
    activeProjectId: projects[0]?.id ?? null,
  };
}
