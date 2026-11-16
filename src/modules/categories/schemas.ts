import { z } from "zod";

// Espelha o banco: nome de 1 a 80 caracteres (sem contar espaços nas pontas).
export const categoryNameSchema = z.string().trim().min(1).max(80);

export const categoryIdSchema = z.uuid();

export const MOVE_DIRECTIONS = ["up", "down"] as const;
export type MoveDirection = (typeof MOVE_DIRECTIONS)[number];
