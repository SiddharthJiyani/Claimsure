import { ValidationError } from './lib/errors.js';

export function routeParam(
  value: string | string[] | undefined,
  name: string,
): string {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw new ValidationError(`${name} is required`);
  return resolved;
}
