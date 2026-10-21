import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Cinema, Hall, Movie, Page, Show } from '../../shared/domain.ts';
import { GENRES } from '../../shared/domain.ts';
import { idSchema } from '../../shared/validation.ts';
import { db } from './db.ts';
import { assert } from './errors.ts';
import { expireOrders } from './order-store.ts';

interface MovieRow extends Omit<Movie, 'cast' | 'featured' | 'watchlisted'> {
  castJson: string;
  featured: number;
  watchlisted: number;
}
const movieSelect = `SELECT m.id,m.title,m.english_title englishTitle,m.genre,m.duration_minutes durationMinutes,
  m.language,m.release_date releaseDate,m.synopsis,m.director,m.cast_json castJson,m.poster,m.accent,m.status,m.featured,m.editorial_score editorialScore,
  (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.movie_id=m.id AND r.status='approved') rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.movie_id=m.id AND r.status='approved') reviewCount,
  EXISTS(SELECT 1 FROM watchlist w WHERE w.movie_id=m.id AND w.user_id=?) watchlisted FROM movies m`;
const movieDTO = (row: MovieRow): Movie => {
  const { castJson, ...rest } = row;
  return {
    ...rest,
    cast: JSON.parse(castJson) as string[],
    featured: !!row.featured,
    watchlisted: !!row.watchlisted,
  };
};
export function getMovie(id: number, userId = 0) {
  const row = db.get<MovieRow>(`${movieSelect} WHERE m.id=?`, userId, id);
  return row ? movieDTO(row) : undefined;
}
export function listMovies(userId = 0): Movie[] {
  return db.all<MovieRow>(movieSelect, userId).map(movieDTO);
}
export function getHalls(): Hall[] {
  return db.all<Hall>(
    'SELECT id,cinema_id cinemaId,name,format,rows_count rows,columns_count columns FROM halls',
  );
}
export const showSelect = `SELECT s.id,s.movie_id movieId,h.cinema_id cinemaId,s.hall_id hallId,s.starts_at startsAt,s.ends_at endsAt,
  s.price_cents priceCents,s.status,m.title movieTitle,m.poster moviePoster,c.name cinemaName,c.city,h.name hallName,h.format,
  h.rows_count rows,h.columns_count columns,(h.rows_count*h.columns_count-(SELECT COUNT(*) FROM seat_claims sc WHERE sc.show_id=s.id)) availableSeats
  FROM shows s JOIN movies m ON m.id=s.movie_id JOIN halls h ON h.id=s.hall_id JOIN cinemas c ON c.id=h.cinema_id`;
export function getShow(id: number) {
  return db.get<Show>(`${showSelect} WHERE s.id=?`, id);
}
export function listCinemas(): Cinema[] {
  return db
    .all<Omit<Cinema, 'tags'> & { tagsJson: string }>(
      `SELECT c.id,c.name,c.city,c.district,c.address,c.tags_json tagsJson,c.description,
    (SELECT MIN(s.price_cents) FROM shows s JOIN halls h ON h.id=s.hall_id WHERE h.cinema_id=c.id AND s.status='active' AND s.starts_at>?) fromPriceCents FROM cinemas c`,
      Date.now() + 15 * 60000,
    )
    .map(({ tagsJson, ...row }) => ({ ...row, tags: JSON.parse(tagsJson) as string[] }));
}
export function paginate<T>(items: T[], req: Request): Page<T> {
  const page = z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
  const pageSize = z.coerce.number().int().min(1).max(100).default(20).parse(req.query.pageSize);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}
export const catalogRouter = Router();
catalogRouter.get('/meta', (_req, res) =>
  res.json({ data: { genres: GENRES, cities: [...new Set(listCinemas().map((c) => c.city))] } }),
);
catalogRouter.get('/movies', (req, res) => {
  const q = z.string().max(100).default('').parse(req.query.q).toLowerCase();
  const status = z.enum(['now', 'soon', 'all']).default('now').parse(req.query.status);
  const genre = z
    .enum([...GENRES, 'all'])
    .default('all')
    .parse(req.query.genre);
  const sort = z.enum(['featured', 'rating', 'release']).default('featured').parse(req.query.sort);
  const items = listMovies(req.auth?.user.id).filter(
    (m) =>
      m.status !== 'archived' &&
      (status === 'all' || m.status === status) &&
      (genre === 'all' || m.genre === genre) &&
      `${m.title} ${m.englishTitle} ${m.director}`.toLowerCase().includes(q),
  );
  items.sort((a, b) =>
    sort === 'rating'
      ? (b.rating ?? b.editorialScore) - (a.rating ?? a.editorialScore)
      : sort === 'release'
        ? b.releaseDate.localeCompare(a.releaseDate)
        : Number(b.featured) - Number(a.featured) || b.editorialScore - a.editorialScore,
  );
  res.json({ data: paginate(items, req) });
});
catalogRouter.get('/movies/:id', (req, res) => {
  const movie = getMovie(idSchema.parse(req.params.id), req.auth?.user.id);
  assert(movie && movie.status !== 'archived', 404, 'MOVIE_NOT_FOUND', '影片暂未上架');
  res.json({ data: movie });
});
catalogRouter.get('/cinemas', (req, res) => {
  const q = z.string().max(100).default('').parse(req.query.q).toLowerCase();
  const city = z.string().max(30).default('').parse(req.query.city);
  res.json({
    data: listCinemas().filter(
      (c) => (!city || c.city === city) && `${c.name}${c.address}${c.district}`.toLowerCase().includes(q),
    ),
  });
});
catalogRouter.get('/cinemas/:id', (req, res) => {
  const id = idSchema.parse(req.params.id);
  const cinema = listCinemas().find((c) => c.id === id);
  assert(cinema, 404, 'CINEMA_NOT_FOUND', '影院不存在');
  res.json({ data: { cinema, halls: getHalls().filter((h) => h.cinemaId === id) } });
});
catalogRouter.get('/shows', (req, res) => {
  expireOrders();
  const movieId = req.query.movieId === undefined ? undefined : idSchema.parse(req.query.movieId);
  const cinemaId = req.query.cinemaId === undefined ? undefined : idSchema.parse(req.query.cinemaId);
  const day = req.query.day === undefined ? undefined : z.iso.date().parse(req.query.day);
  const from = day ? Date.parse(`${day}T00:00:00+08:00`) : 0;
  const items = db
    .all<Show>(
      `${showSelect} WHERE s.status='active' AND m.status='now' AND s.starts_at>? ORDER BY s.starts_at`,
      Date.now() + 15 * 60000,
    )
    .filter(
      (s) =>
        (!movieId || s.movieId === movieId) &&
        (!cinemaId || s.cinemaId === cinemaId) &&
        (!day || (s.startsAt >= from && s.startsAt < from + 86400000)),
    );
  res.json({ data: paginate(items, req) });
});
