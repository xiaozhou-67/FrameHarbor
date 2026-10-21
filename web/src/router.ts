import { createRouter, createWebHistory } from 'vue-router';
import { auth, ensureSession } from './state.ts';

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, saved) {
    if (saved) return saved;
    return to.path === from.path ? undefined : { top: 0 };
  },
  routes: [
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue'), meta: { title: '发现' } },
    { path: '/movies', component: () => import('./views/MoviesView.vue'), meta: { title: '电影' } },
    {
      path: '/movies/:id(\\d+)',
      component: () => import('./views/MovieView.vue'),
      meta: { title: '影片详情' },
    },
    { path: '/cinemas', component: () => import('./views/CinemasView.vue'), meta: { title: '影院' } },
    {
      path: '/cinemas/:id(\\d+)',
      component: () => import('./views/CinemaView.vue'),
      meta: { title: '影院详情' },
    },
    {
      path: '/booking/:id(\\d+)',
      component: () => import('./views/BookingView.vue'),
      meta: { title: '选座购票', auth: true },
    },
    {
      path: '/orders',
      component: () => import('./views/OrdersView.vue'),
      meta: { title: '我的票夹', auth: true },
    },
    {
      path: '/account',
      component: () => import('./views/AccountView.vue'),
      meta: { title: '我的帧港', auth: true },
    },
    { path: '/login', component: () => import('./views/LoginView.vue'), meta: { title: '登录' } },
    {
      path: '/admin',
      component: () => import('./views/admin/AdminLayout.vue'),
      meta: { admin: true, auth: true },
      children: [
        { path: '', component: () => import('./views/admin/DashboardView.vue'), meta: { title: '运营概览' } },
        {
          path: 'movies',
          component: () => import('./views/admin/ManageMoviesView.vue'),
          meta: { title: '影片管理' },
        },
        {
          path: 'venues',
          component: () => import('./views/admin/ManageVenuesView.vue'),
          meta: { title: '影院与影厅' },
        },
        {
          path: 'shows',
          component: () => import('./views/admin/ManageShowsView.vue'),
          meta: { title: '排片管理' },
        },
        {
          path: 'orders',
          component: () => import('./views/admin/ManageOrdersView.vue'),
          meta: { title: '订单与核销' },
        },
        {
          path: 'reviews',
          component: () => import('./views/admin/ManageReviewsView.vue'),
          meta: { title: '评论审核' },
        },
        { path: 'logs', component: () => import('./views/admin/LogsView.vue'), meta: { title: '操作记录' } },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('./views/NotFoundView.vue'),
      meta: { title: '页面走丢了' },
    },
  ],
});
router.beforeEach(async (to) => {
  await ensureSession();
  if (to.meta.auth && !auth.user) return { path: '/login', query: { next: to.fullPath } };
  if (to.meta.admin && auth.user?.role !== 'admin') return '/';
});
router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '光影生活')} · 帧港 FrameHarbor`;
});
