import { z } from "zod";

// Login não impõe regra de complexidade (isso é do cadastro); só limites sãos de tamanho.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export function parseLogin(formData: FormData): LoginInput | null {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  return result.success ? result.data : null;
}
