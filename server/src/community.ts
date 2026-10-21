import { Router } from 'express';
import { idSchema, profileSchema, reviewSchema } from '../../shared/validation.ts';
import type { Recommendation, Review } from '../../shared/domain.ts';
import { requireAuth } from './auth.ts';
import { getMovie, listMovies, paginate } from './catalog.ts';
import { db } from './db.ts';
import { assert } from './errors.ts';

export const reviewSelect = `SELECT r.id,r.revision,r.movie_id movieId,r.user_id userId,u.display_name displayName,m.title movieTitle,
  r.rating,r.content,r.status,r.created_at createdAt FROM reviews r JOIN users u ON u.id=r.user_id JOIN movies m ON m.id=r.movie_id`;
export const communityRouter = Router();
communityRouter.get('/movies/:id/reviews', (req, res) => {
  const id = idSchema.parse(req.params.id);
  res.json({
    data: paginate(
      db.all<Review>(
        `${reviewSelect} WHERE r.movie_id=? AND r.status='approved' ORDER BY r.created_at DESC`,
        id,
      ),
      req,
    ),
  });
});
communityRouter.get('/recommendations', (req, res) => {
  const genres = req.auth?.user.genres ?? [];
  const movies = listMovies(req.auth?.user.id).filter((m) => m.status !== 'archived');
  const watchedGenres = new Set(movies.filter((m) => m.watchlisted).map((m) => m.genre));
  const items: Recommendation[] = movies
    .filter((m) => !m.watchlisted)
    .map((movie) => ({
      movie,
      reason: genres.includes(movie.genre)
        ? `因为你喜欢${movie.genre}`
        : watchedGenres.has(movie.genre)
          ? '与你的想看清单相似'
          : '帧港编辑精选',
    }));
  items.sort((a, b) => {
    const score = (v: Recommendation) =>
      (genres.includes(v.movie.genre) ? 20 : watchedGenres.has(v.movie.genre) ? 10 : 0) +
      v.movie.editorialScore;
    return score(b) - score(a);
  });
  res.json({ data: items.slice(0, 4) });
});
communityRouter.use('/me', requireAuth);
communityRouter.put('/me/profile', (req, res) => {
  const input = profileSchema.parse(req.body);
  db.run(
    'UPDATE users SET display_name=?,genres_json=? WHERE id=?',
    input.displayName,
    JSON.stringify(input.genres),
    req.auth!.user.id,
  );
  res.json({ data: { ...req.auth!.user, ...input } });
});
communityRouter.get('/me/watchlist', (req, res) =>
  res.json({ data: listMovies(req.auth!.user.id).filter((m) => m.watchlisted) }),
);
communityRouter.put('/me/watchlist/:id', (req, res) => {
  const id = idSchema.parse(req.params.id);
  const movie = getMovie(id);
  assert(movie && movie.status !== 'archived', 404, 'MOVIE_NOT_FOUND', '影片暂未上架');
  db.run(
    'INSERT OR IGNORE INTO watchlist(user_id,movie_id,created_at) VALUES(?,?,?)',
    req.auth!.user.id,
    id,
    Date.now(),
  );
  res.json({ data: { watchlisted: true } });
});
communityRouter.delete('/me/watchlist/:id', (req, res) => {
  db.run(
    'DELETE FROM watchlist WHERE user_id=? AND movie_id=?',
    req.auth!.user.id,
    idSchema.parse(req.params.id),
  );
  res.json({ data: { watchlisted: false } });
});
communityRouter.get('/me/reviews', (req, res) =>
  res.json({
    data: db.all<Review>(`${reviewSelect} WHERE r.user_id=? ORDER BY r.created_at DESC`, req.auth!.user.id),
  }),
);
communityRouter.put('/me/reviews/:id', (req, res) => {
  const movieId = idSchema.parse(req.params.id);
  const input = reviewSchema.parse(req.body);
  assert(
    getMovie(movieId)?.status !== 'archived' && getMovie(movieId),
    404,
    'MOVIE_NOT_FOUND',
    '影片暂未上架',
  );
  db.run(
    `INSERT INTO reviews(user_id,movie_id,rating,content,status,created_at) VALUES(?,?,?,?,'pending',?)
    ON CONFLICT(user_id,movie_id) DO UPDATE SET rating=excluded.rating,content=excluded.content,status='pending',created_at=excluded.created_at,revision=reviews.revision+1`,
    req.auth!.user.id,
    movieId,
    input.rating,
    input.content,
    Date.now(),
  );
  res.json({
    data: db.get<Review>(`${reviewSelect} WHERE r.movie_id=? AND r.user_id=?`, movieId, req.auth!.user.id),
  });
});
