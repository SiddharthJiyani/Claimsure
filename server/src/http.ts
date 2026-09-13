import { HttpError } from "./middleware/error-handler.js";

export function routeParam(
  value: string | string[] | undefined,
  name: string,
): string {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw new HttpError(400, `${name} is required`);
  return resolved;
}
