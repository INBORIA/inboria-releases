import { Environment, Paddle } from "@paddle/paddle-node-sdk";

let paddleInstance: Paddle | null = null;

export function getPaddleClient(): Paddle {
  if (paddleInstance) return paddleInstance;

  const apiKey = process.env["PADDLE_API_KEY"];
  if (!apiKey) {
    throw new Error("PADDLE_API_KEY is not set");
  }

  const env = process.env["PADDLE_ENVIRONMENT"] === "sandbox"
    ? Environment.sandbox
    : Environment.production;

  paddleInstance = new Paddle(apiKey, { environment: env });
  return paddleInstance;
}

export function getPaddleClientToken(): string {
  const token = process.env["PADDLE_CLIENT_TOKEN"];
  if (!token) {
    throw new Error("PADDLE_CLIENT_TOKEN is not set");
  }
  return token;
}

export function getPaddleWebhookSecret(): string {
  const secret = process.env["PADDLE_WEBHOOK_SECRET"];
  if (!secret) {
    throw new Error("PADDLE_WEBHOOK_SECRET is not set");
  }
  return secret;
}
