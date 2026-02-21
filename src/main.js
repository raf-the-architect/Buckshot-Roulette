/**
 * main.js
 * Entry point for the Vue + Phaser + Firebase multiplayer application
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

// Import global styles
import './styles/index.css';

// =========================================================================
// ROUTER CONFIGURATION
// =========================================================================
const routes = [
    {
        path: '/',
        name: 'Home',
        component: App
    },
    {
        path: '/offline',
        name: 'Offline',
        component: App
    },
    {
        path: '/join/:code',
        name: 'Join',
        component: App
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

// =========================================================================
// APP INITIALIZATION
// =========================================================================
const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

app.mount('#app');
