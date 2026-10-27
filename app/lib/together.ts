import type { AlongRequest } from "./requests";

export const togetherAssets = {
  milestone: "/together/together-milestone.png", memory: "/together/together-memory.png",
  spark: "/together/together-spark.png", question: "/together/together-question.png",
} as const;
export const starterQuestion = { id: "small-smile-v1", text: "What’s one small thing that made you smile today?" };
export type TogetherAnswer = { questionId: string; question: string; text: string; savedAt: number };
export type TogetherMemory = { id: string; caption: string; createdAt: number; photo: Blob };
export type TogetherData = { startDate: string | null; answers: TogetherAnswer[]; memories: TogetherMemory[]; completedRequests: AlongRequest[] };
export type TogetherPair = { id: string; ownAvatar: string | null; partnerAvatar: string | null };

// Only an authenticated pairing provider may supply this identity. The adapter
// must scope every operation to this pair and authorize both members server-side.
// No invented endpoints or local seeded ride records are used as pair evidence.
export interface TogetherSync {
  load(): Promise<TogetherData>;
  subscribe(listener: (data: TogetherData) => void): () => void;
  saveDate(date: string): Promise<void>;
  saveAnswer(answer: TogetherAnswer): Promise<void>;
  saveMemory(memory: TogetherMemory): Promise<void>;
}
export const emptyTogetherData = (): TogetherData => ({ startDate: null, answers: [], memories: [], completedRequests: [] });

// Calendar dates are deliberately counted in UTC, avoiding DST and time-of-day
// rounding while treating the relationship start day as day zero.
export function calendarDay(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date ? parsed / 86400000 : null;
}
export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function relationshipDays(start: string | null, today = localDate()): number | null {
  if (!start) return null;
  const first = calendarDay(start), last = calendarDay(today);
  return first === null || last === null || first > last ? null : last - first;
}
export function formatTogetherDate(date: string): string {
  return calendarDay(date) === null ? "" : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
export function completedLittleMoments(requests: AlongRequest[]): AlongRequest[] {
  return requests.filter(item => item.status === "completed").sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
}
export function isMemoryPhoto(file: Pick<Blob, "type" | "size">) {
  return ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"].includes(file.type) && file.size > 0 && file.size <= 15 * 1024 * 1024;
}

type StoredText = { startDate: string | null; answers: TogetherAnswer[] };
type TextStorage = Pick<Storage, "getItem" | "setItem">;
const textKey = (pairId: string) => `along.together.local.v1:${encodeURIComponent(pairId)}`;
export function readTogetherText(storage: TextStorage, pairId: string): StoredText {
  try {
    const value = JSON.parse(storage.getItem(textKey(pairId)) || "null");
    return { startDate: typeof value?.startDate === "string" && relationshipDays(value.startDate) !== null ? value.startDate : null,
      answers: Array.isArray(value?.answers) ? value.answers.filter((answer: TogetherAnswer) => answer && typeof answer.questionId === "string" && typeof answer.question === "string" && typeof answer.text === "string" && answer.text.length <= 500 && Number.isFinite(answer.savedAt)).slice(0, 30) : [] };
  } catch { return { startDate: null, answers: [] }; }
}
export function saveTogetherText(storage: TextStorage, pairId: string, data: StoredText) {
  // Propagate quota/privacy errors: the UI must never claim a durable save failed silently.
  storage.setItem(textKey(pairId), JSON.stringify(data));
}

// Photos are kept as original Blobs in IndexedDB, never base64 in localStorage.
// The database stores no Tour photos or data from an unverified pair.
const DB_NAME = "along.together.local.v1";
function openMemoryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Photo storage unavailable")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("memories", { keyPath: "key" });
      store.createIndex("pairId", "pairId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Photo storage busy"));
  });
}
export async function loadLocalMemories(pairId: string): Promise<TogetherMemory[]> {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("memories", "readonly");
    const request = transaction.objectStore("memories").index("pairId").getAll(pairId);
    transaction.oncomplete = () => { db.close(); resolve((request.result as TogetherMemory[]).filter(item => item.photo instanceof Blob).sort((a, b) => b.createdAt - a.createdAt)); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}
export async function saveLocalMemory(pairId: string, memory: TogetherMemory): Promise<void> {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("memories", "readwrite");
    transaction.objectStore("memories").put({ ...memory, pairId, key: `${pairId}:${memory.id}` });
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}
