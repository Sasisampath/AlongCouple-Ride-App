export const requestCategories = [
  { id: "chocolate", label: "Chocolate", headline: "Chocolate?", image: "/requests/chocolate.png", placeholder: "Dairy Milk please" },
  { id: "coffee", label: "Coffee", headline: "Coffee?", image: "/requests/coffee.png", placeholder: "Cold coffee please" },
  { id: "flowers", label: "Flowers", headline: "Flowers?", image: "/requests/flowers.png", placeholder: "A little bunch, please" },
  { id: "care", label: "Care", headline: "What do you need?", image: "/requests/care.png", placeholder: "Paracetamol please" },
  { id: "grocery", label: "Grocery", headline: "What should they get?", image: "/requests/grocery.png", placeholder: "Milk, bread..." },
  { id: "custom", label: "Something else", headline: "Ask for something", image: "/requests/something-else.png", placeholder: "What do you need?" },
] as const;

export type RequestCategory = typeof requestCategories[number]["id"];
export const careOptions = ["Medicine", "Sanitary pads", "Bandage", "Other care"] as const;
export type CareOption = typeof careOptions[number];
export type RequestStatus = "sending" | "sent" | "acknowledged" | "completed" | "cancelled" | "unavailable";
export type RequestDraft = { category: RequestCategory; note: string; care?: CareOption };
export type AlongRequest = RequestDraft & {
  id: string; direction: "outgoing" | "incoming"; status: RequestStatus; createdAt: number; updatedAt: number;
};

// A real adapter must be scoped to the authenticated pair, enforce ownership on
// mutations, and emit partner updates. A successful send means server acceptance.
// The legacy local ride store is deliberately not a delivery service.
export interface PartnerRequestConnection {
  pairId: string;
  load(): Promise<AlongRequest[]>;
  subscribe(listener: (requests: AlongRequest[]) => void): () => void;
  send(draft: RequestDraft): Promise<AlongRequest>;
  edit(id: string, draft: RequestDraft): Promise<AlongRequest>;
  cancel(id: string): Promise<AlongRequest>;
  acknowledge(id: string): Promise<AlongRequest>;
  complete(id: string): Promise<AlongRequest>;
  unavailable(id: string): Promise<AlongRequest>;
}

export function isAlongRequest(value: unknown): value is AlongRequest {
  if (!value || typeof value !== "object") return false;
  const item = value as AlongRequest;
  return typeof item.id === "string" && item.id.length > 0
    && requestCategories.some(category => category.id === item.category)
    && typeof item.note === "string" && item.note.length <= 280
    && (!item.care || careOptions.includes(item.care))
    && ["outgoing", "incoming"].includes(item.direction)
    && ["sending", "sent", "acknowledged", "completed", "cancelled", "unavailable"].includes(item.status)
    && Number.isFinite(item.createdAt) && Number.isFinite(item.updatedAt);
}

export const requestStatusText: Record<RequestStatus, string> = {
  sending: "Sending…", sent: "Waiting for your person", acknowledged: "Got it ❤️",
  completed: "Done ❤️", cancelled: "Cancelled", unavailable: "Can’t right now",
};
export function isActiveRequest(item: AlongRequest) {
  return ["sending", "sent", "acknowledged"].includes(item.status);
}

export function advanceTourRequests(items: AlongRequest[], now: number): AlongRequest[] {
  let changed = false;
  const next = items.map(item => {
    if (item.direction !== "outgoing") return item;
    const age = now - item.createdAt;
    const status = item.status === "sending" && age >= 650 ? "sent"
      : item.status === "sent" && age >= 2600 ? "acknowledged" : item.status;
    if (status === item.status) return item;
    changed = true;
    return { ...item, status, updatedAt: now };
  });
  return changed ? next : items;
}

export function readTourRequests(key: string): AlongRequest[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data.filter(isAlongRequest).slice(0, 50) : [];
  } catch { return []; }
}

export function requestDate(timestamp: number, now = Date.now()) {
  const date = new Date(timestamp);
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) return "Today";
  today.setDate(today.getDate() - 1);
  return date.toDateString() === today.toDateString() ? "Yesterday"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
