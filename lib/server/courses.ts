import { env } from "cloudflare:workers";
import { createCourseStore } from "./course-store";

export function courseStore() {
  if (!env.DB) throw new Error("DB binding is unavailable");
  return createCourseStore(env.DB);
}
