export const GENRES = ['科幻', '剧情', '动画', '悬疑', '冒险', '纪录'] as const;
export type Genre = (typeof GENRES)[number];
export type MovieStatus = 'now' | 'soon' | 'archived';
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired' | 'refunded';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export interface User {
  id: number;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  genres: Genre[];
}
export interface AuthState {
  user: User | null;
  csrfToken: string | null;
}
export interface Movie {
  id: number;
  title: string;
  englishTitle: string;
  genre: Genre;
  durationMinutes: number;
  language: string;
  releaseDate: string;
  synopsis: string;
  director: string;
  cast: string[];
  poster: string;
  accent: string;
  status: MovieStatus;
  featured: boolean;
  editorialScore: number;
  rating: number | null;
  reviewCount: number;
  watchlisted: boolean;
}
export interface Cinema {
  id: number;
  name: string;
  city: string;
  district: string;
  address: string;
  tags: string[];
  description: string;
  fromPriceCents: number | null;
}
export interface Hall {
  id: number;
  cinemaId: number;
  name: string;
  format: string;
  rows: number;
  columns: number;
}
export interface Show {
  id: number;
  movieId: number;
  cinemaId: number;
  hallId: number;
  startsAt: number;
  endsAt: number;
  priceCents: number;
  status: 'active' | 'cancelled';
  movieTitle: string;
  moviePoster: string;
  cinemaName: string;
  city: string;
  hallName: string;
  format: string;
  rows: number;
  columns: number;
  availableSeats: number;
}
export interface Seat {
  id: string;
  row: number;
  column: number;
  state: 'available' | 'held' | 'sold' | 'mine';
}
export interface SeatMap {
  show: Show;
  seats: Seat[];
  maxPerOrder: number;
}
export interface Quote {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
}
export interface Order extends Quote {
  id: string;
  userId: number;
  showId: number;
  movieId: number;
  movieTitle: string;
  poster: string;
  cinemaName: string;
  hallName: string;
  format: string;
  startsAt: number;
  endsAt: number;
  seats: string[];
  status: OrderStatus;
  expiresAt: number;
  createdAt: number;
  ticketCode: string | null;
  checkedInAt: number | null;
  displayName: string;
}
export interface Review {
  revision: number;
  id: number;
  movieId: number;
  userId: number;
  displayName: string;
  movieTitle: string;
  rating: number;
  content: string;
  status: ReviewStatus;
  createdAt: number;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Recommendation {
  movie: Movie;
  reason: string;
}
export interface AuditLog {
  id: number;
  actorName: string;
  action: string;
  target: string;
  detail: string;
  createdAt: number;
}
export interface Dashboard {
  revenueCents: number;
  paidOrders: number;
  tickets: number;
  pendingReviews: number;
  activeShows: number;
  occupancyPercent: number;
  daily: { day: string; revenueCents: number; orders: number }[];
  popular: { title: string; tickets: number; revenueCents: number }[];
}
export interface ApiResponse<T> {
  data: T;
}
export interface ApiFailure {
  error: { code: string; message: string };
}
export const ORDER_LABELS: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已出票',
  cancelled: '已取消',
  expired: '已超时',
  refunded: '已退款',
};
export const BUSINESS = {
  holdMinutes: 8,
  refundMinutes: 45,
  stopSalesMinutes: 15,
  cleanupMinutes: 20,
  maxSeats: 4,
  timezone: 'Asia/Shanghai',
} as const;
