import { z } from "zod";

export const tenantSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export type TenantInput = z.infer<typeof tenantSchema>;
