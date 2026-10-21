import { z } from 'zod';
import { GENRES } from './domain.ts';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const idSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const emailSchema = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const passwordSchema = z.string().min(12, '密码至少 12 位').max(128);
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: text(2, 30),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const profileSchema = z.object({
  displayName: text(2, 30),
  genres: z
    .array(z.enum(GENRES))
    .max(6)
    .transform((v) => [...new Set(v)]),
});
export const reviewSchema = z.object({ rating: z.number().int().min(1).max(10), content: text(20, 1000) });
export const orderSchema = z.object({
  showId: idSchema,
  seats: z
    .array(z.string().regex(/^R\d{1,2}-C\d{1,2}$/))
    .min(1)
    .max(4)
    .refine((v) => new Set(v).size === v.length, '座位不能重复'),
  couponCode: z.string().trim().toUpperCase().max(30).optional().default(''),
});
export const movieSchema = z.object({
  title: text(1, 60),
  englishTitle: text(1, 100),
  genre: z.enum(GENRES),
  durationMinutes: z.number().int().min(30).max(300),
  language: text(1, 30),
  releaseDate: z.iso.date(),
  synopsis: text(20, 2000),
  director: text(1, 100),
  cast: z.array(text(1, 50)).min(1).max(12),
  poster: z.string().regex(/^\/art\/(?:aurora|tide|orbit|forest|echo|island|light|moon)\.svg$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  status: z.enum(['now', 'soon', 'archived']),
  featured: z.boolean(),
  editorialScore: z.number().min(0).max(10),
});
export const cinemaSchema = z.object({
  name: text(2, 60),
  city: text(2, 30),
  district: text(2, 30),
  address: text(5, 150),
  tags: z.array(text(1, 20)).max(6),
  description: text(10, 500),
});
export const hallSchema = z.object({
  cinemaId: idSchema,
  name: text(1, 30),
  format: z.enum(['激光 2D', '杜比全景声', 'IMAX', 'CINITY']),
  rows: z.number().int().min(4).max(15),
  columns: z.number().int().min(6).max(20),
});
export const showSchema = z.object({
  movieId: idSchema,
  hallId: idSchema,
  startsAt: z.number().int().positive().max(8640000000000000),
  priceCents: z.number().int().min(100).max(100000),
});
export const moderationSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  revision: z.number().int().positive(),
});
export type MovieInput = z.infer<typeof movieSchema>;
export type CinemaInput = z.infer<typeof cinemaSchema>;
export type HallInput = z.infer<typeof hallSchema>;
export type ShowInput = z.infer<typeof showSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
