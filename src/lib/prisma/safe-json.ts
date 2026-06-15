import {Prisma} from '@prisma/client';

export function toPrismaJson(value: unknown, fallback: unknown = {}): Prisma.InputJsonValue {
  const source = value === undefined || value === null ? fallback : value;
  try {
    const serialized = JSON.stringify(source, (_, item) => typeof item === 'bigint' ? item.toString() : item);
    if (serialized === undefined) return toPrismaJson(fallback === source ? {} : fallback, {});
    return JSON.parse(serialized) as Prisma.InputJsonValue;
  } catch {
    const serializedFallback = JSON.stringify(fallback ?? {});
    return JSON.parse(serializedFallback === undefined ? '{}' : serializedFallback) as Prisma.InputJsonValue;
  }
}

export function toPrismaJsonArray(value: unknown): Prisma.InputJsonValue {
  return toPrismaJson(Array.isArray(value) ? value : [], []);
}

export function toPrismaJsonObject(value: unknown): Prisma.InputJsonValue {
  return toPrismaJson(value && typeof value === 'object' && !Array.isArray(value) ? value : {}, {});
}
