import type { AppState, Project, TaskPriority, TaskStatus, Todo } from "../types";

type SampleTodoInput = {
  id: string;
  title: string;
  dueDate?: string | null;
  estimate?: string;
  status?: TaskStatus;
  progress?: number;
  workerComment?: string;
  managerComment?: string;
  issueRisk?: string;
  priority?: TaskPriority;
  memo?: string;
};

function createTodo({
  id,
  title,
  dueDate = null,
  estimate = "",
  status = "대기",
  progress = status === "완료" ? 1 : 0,
  workerComment = "",
  managerComment = "",
  issueRisk = "",
  priority = "보통",
  memo = "",
}: SampleTodoInput): Todo {
  const completed = status === "완료" || progress >= 1;

  return {
    id,
    title,
    dueDate,
    estimate,
    status: completed ? "완료" : status,
    progress: completed ? 1 : progress,
    workerComment,
    managerComment,
    issueRisk,
    priority,
    memo,
    completed,
  };
}

export function createSampleState(): AppState {
  const projects: Project[] = [
    {
      id: "project-katech-tms-aps-hils",
      clientName: "KATECH",
      projectNumber: "",
      name: "TMS HILs - APS HILs",
      periodText: "26.06 ~",
      periodStart: "2026-06-01",
      periodEnd: null,
      color: "#2563eb",
      todos: [
        createTodo({
          id: "todo-katech-ui-dev",
          title: "APS, TMS UI 개발",
          estimate: "1W",
          workerComment: "피드백 대기중",
        }),
        createTodo({
          id: "todo-katech-tms-hils-link",
          title: "TMS HILs 개발 및 연동",
          estimate: "1W",
          workerComment: "일정 대기중",
        }),
        createTodo({
          id: "todo-katech-aps-hils-link",
          title: "APS HILs 개발 및 연동",
          estimate: "1W",
          workerComment: "일정 대기중",
        }),
      ],
    },
    {
      id: "project-ksoe-custom-device",
      clientName: "KSOE",
      projectNumber: "",
      name: "Custom Device 개발 - (OPCUA,ModbusTCP,MQTT)",
      periodText: "25.06 ~",
      periodStart: "2025-06-01",
      periodEnd: null,
      color: "#16a34a",
      todos: [
        createTodo({
          id: "todo-ksoe-opcua-server",
          title: "OPCUA server",
          estimate: "1W",
          status: "대기",
          workerComment: "연말 연기",
        }),
        createTodo({
          id: "todo-ksoe-opcua-client",
          title: "OPCUA client",
          estimate: "1W",
          status: "완료",
        }),
        createTodo({
          id: "todo-ksoe-opcua-certification",
          title: "OPCUA client: certification 기능 개발",
          dueDate: "2026-06-02",
          estimate: "1W",
          status: "진행중",
          progress: 0.5,
        }),
        createTodo({
          id: "todo-ksoe-modbustcp-master",
          title: "ModbusTCP Master",
          estimate: "1W",
          status: "완료",
        }),
        createTodo({
          id: "todo-ksoe-modbustcp-slave",
          title: "ModbusTCP Slave",
          estimate: "1W",
          status: "완료",
        }),
        createTodo({
          id: "todo-ksoe-mqtt-broker",
          title: "MQTT Broker",
          estimate: "1W",
          status: "대기",
          workerComment: "연말 연기",
        }),
        createTodo({
          id: "todo-ksoe-mqtt-client",
          title: "MQTT Client",
          estimate: "1W",
          status: "대기",
          workerComment: "연말 연기",
        }),
      ],
    },
    {
      id: "project-ksoe-sofc-amesim",
      clientName: "KSOE",
      projectNumber: "P260017",
      name: "Simcenter Amesim 소프트웨어 활용 - SOFC 시뮬레이션 모델 개발",
      periodText: "26.04 ~ 26.12",
      periodStart: "2026-04-01",
      periodEnd: "2026-12-31",
      color: "#0f766e",
      todos: [
        createTodo({
          id: "todo-ksoe-amesim-training",
          title: "AMESIM 모델개발 교육",
          estimate: "6M",
          status: "진행중",
          progress: 0.1,
        }),
        createTodo({
          id: "todo-ksoe-amesim-training-april",
          title: "AMESIM 모델개발 교육 - 4월",
          estimate: "3D",
          status: "완료",
        }),
        createTodo({
          id: "todo-ksoe-amesim-training-june",
          title: "AMESIM 모델개발 교육 - 6월",
          dueDate: "2026-06-09",
          estimate: "3D",
          status: "진행중",
          workerComment: "교육 6월 준비, 교육자료 개발",
        }),
        createTodo({
          id: "todo-ksoe-h50-model",
          title: "H50 모델 고도화",
          estimate: "6M",
          status: "대기",
        }),
        createTodo({
          id: "todo-ksoe-h50-model-improvement",
          title: "H50 모델 고도화 - 모델 개선, 수정, 문서화 등",
          dueDate: "2026-06-09",
          estimate: "3D",
          status: "진행중",
          progress: 0.1,
          workerComment: "진도 점검 회의 6월 준비",
        }),
      ],
    },
    {
      id: "project-ksoe-pcs-hils",
      clientName: "KSOE",
      projectNumber: "",
      name: "PCS HILs",
      periodText: "26.01 ~",
      periodStart: "2026-01-01",
      periodEnd: null,
      color: "#7c3aed",
      todos: [
        createTodo({
          id: "todo-ksoe-pcs-hils-standby",
          title: "",
          estimate: "*",
          status: "대기",
          workerComment: "업무 확인 필요",
        }),
      ],
    },
    {
      id: "project-ksoe-submarine-model",
      clientName: "KSOE",
      projectNumber: "",
      name: "잠수함 모델 개발",
      periodText: "미확정",
      periodStart: null,
      periodEnd: null,
      color: "#0891b2",
      todos: [
        createTodo({
          id: "todo-ksoe-submarine-model-standby",
          title: "",
          estimate: "*",
          status: "대기",
          workerComment: "업무 확인 필요",
        }),
      ],
    },
    {
      id: "project-kyungchang-e-shift-hils",
      clientName: "경창산업",
      projectNumber: "",
      name: "E-Shift HILs",
      periodText: "26.04 ~ 26.07",
      periodStart: "2026-04-01",
      periodEnd: "2026-07-31",
      color: "#f97316",
      todos: [
        createTodo({
          id: "todo-kyungchang-fpga-spi",
          title: "FPGA SPI 통신 프로토콜 추가",
          dueDate: "2026-06-04",
          estimate: "1W",
          status: "진행중",
          progress: 0,
          workerComment: "준비 완료",
        }),
        createTodo({
          id: "todo-kyungchang-auto-test-upgrade",
          title: "AUTO TEST 업그레이드: DTC, Current, Past 기능 추가",
          dueDate: "2026-06-16",
          estimate: "3D",
          status: "미완",
        }),
        createTodo({
          id: "todo-kyungchang-veristand-project",
          title: "4개 차종 대상 VeriStand Project 개발",
          dueDate: "2026-06-16",
          estimate: "1W",
          status: "미완",
        }),
      ],
    },
    {
      id: "project-gmb-water-pump-mils",
      clientName: "GMB",
      projectNumber: "",
      name: "water pump MILs",
      periodText: "25.08 ~ 26.06",
      periodStart: "2025-08-01",
      periodEnd: "2026-06-30",
      color: "#9333ea",
      todos: [
        createTodo({
          id: "todo-gmb-mils-system-test",
          title: "MILs 시스템 단독테스트",
          estimate: "1W",
          status: "완료",
        }),
        createTodo({
          id: "todo-gmb-pump-auto-test",
          title: "펌프 대상 AUTO TEST",
          estimate: "1M",
          status: "완료",
        }),
        createTodo({
          id: "todo-gmb-mils-program-add",
          title: "MILs 프로그램 추가개발 (manual test, dashboard, 사용자 메뉴얼 등)",
          estimate: "2M",
          status: "완료",
        }),
        createTodo({
          id: "todo-gmb-mils-feedback",
          title: "MILs 프로그램 피드백 및 개선",
          dueDate: "2026-06-12",
          estimate: "1W",
          status: "진행중",
          workerComment: "피드백 대기중",
        }),
      ],
    },
    {
      id: "project-hdx-adas",
      clientName: "HDX",
      projectNumber: "",
      name: "ADAS",
      periodText: "25.08 ~ 26.06",
      periodStart: "2025-08-01",
      periodEnd: "2026-06-30",
      color: "#dc2626",
      todos: [
        createTodo({
          id: "todo-hdx-sensor-single-test",
          title: "센서 단동 테스트: 라이다, 레이더, 카메라",
          estimate: "1W",
          status: "완료",
        }),
        createTodo({
          id: "todo-hdx-crio-ros2",
          title: "cRIO ROS2 연동 프로그램 개발",
          estimate: "1W",
          status: "완료",
        }),
        createTodo({
          id: "todo-hdx-host-program",
          title: "HOST 프로그램 개발 (RT 모니터링)",
          estimate: "1W",
          status: "완료",
        }),
        createTodo({
          id: "todo-hdx-sensor-logging-replay",
          title: "Sensor, Logging and Replay 기능 개발",
          estimate: "1W",
          status: "완료",
        }),
        createTodo({
          id: "todo-hdx-signal-generation",
          title: "Signal Generation 기능 개발",
          dueDate: "2026-05-23",
          estimate: "1W",
          status: "진행중",
          progress: 0.9,
          priority: "최우선",
          workerComment: "개발 완료, HDX 담당자와 개발내용 공유 예정",
        }),
        createTodo({
          id: "todo-hdx-development-feedback",
          title: "개발 내용 공유 및 피드백 검토",
          dueDate: "2026-06-01",
          estimate: "3D",
          status: "진행중",
        }),
      ],
    },
  ];

  return {
    projects,
    activeProjectId: projects[0]?.id ?? null,
    workLogs: [],
  };
}
