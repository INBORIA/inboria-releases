import { cleanEmailBody } from "./clean-email-body";

type CleanResponse = { id: number; result: string };

let worker: Worker | null = null;
let workerDisabled = false;
let nextId = 1;
const pending = new Map<number, (result: string) => void>();

function getWorker(): Worker | null {
  if (workerDisabled) return null;
  if (typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(
      new URL("../workers/email-parser.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.addEventListener("message", (e: MessageEvent<CleanResponse>) => {
      const cb = pending.get(e.data.id);
      if (cb) {
        pending.delete(e.data.id);
        cb(e.data.result);
      }
    });
    worker.addEventListener("error", () => {
      for (const [, cb] of pending) {
        try { cb(""); } catch {}
      }
      pending.clear();
      try { worker?.terminate(); } catch {}
      worker = null;
      workerDisabled = true;
    });
  } catch {
    workerDisabled = true;
    return null;
  }
  return worker;
}

export function cleanEmailBodyAsync(body: string): Promise<string> {
  return new Promise((resolve) => {
    const w = getWorker();
    if (!w) {
      try {
        resolve(cleanEmailBody(body));
      } catch {
        resolve(body || "");
      }
      return;
    }
    const id = nextId++;
    pending.set(id, resolve);
    try {
      w.postMessage({ id, body });
    } catch {
      pending.delete(id);
      try {
        resolve(cleanEmailBody(body));
      } catch {
        resolve(body || "");
      }
    }
  });
}
