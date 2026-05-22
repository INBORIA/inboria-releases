import { cleanEmailBody } from "../lib/clean-email-body";

export type CleanRequest = { id: number; body: string };
export type CleanResponse = { id: number; result: string };

self.addEventListener("message", (event: MessageEvent<CleanRequest>) => {
  const { id, body } = event.data;
  let result = "";
  try {
    result = cleanEmailBody(body);
  } catch {
    result = body || "";
  }
  (self as unknown as Worker).postMessage({ id, result } satisfies CleanResponse);
});
