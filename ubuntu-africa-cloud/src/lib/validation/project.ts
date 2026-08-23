import { z } from 'zod';
const socialUrl = z.string().trim().url().or(z.literal(''));
export const projectContentSchema = z.object({
 businessName:z.string().trim().min(2).max(120), tagline:z.string().trim().max(160).default(''),
 about:z.string().trim().min(20).max(3000), email:z.string().trim().email().or(z.literal('')),
 phone:z.string().trim().max(30).default(''), whatsapp:z.string().trim().max(30).default(''), address:z.string().trim().max(300).default(''),
 primaryColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/), secondaryColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/),
 facebook:socialUrl.default(''), instagram:socialUrl.default(''), linkedin:socialUrl.default(''),
 services:z.array(z.object({name:z.string().trim().min(2).max(100),description:z.string().trim().min(5).max(500)})).max(12)
});
export const createProjectSchema=z.object({
 name:z.string().trim().min(2).max(120),
 slug:z.string().trim().min(2).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
 templateKey:z.string().trim().min(2).max(80), content:projectContentSchema
});
