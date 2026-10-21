import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.ts';
import './styles/theme.css';
import './styles/responsive.css';

createApp(App).use(router).mount('#app');
