import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Заголовки, без которых Трекер не может прочитать дебаг-сервер: страница
 * Трекера и localhost — разные источники, а vite с 5.4.12 (CVE-2025-24010)
 * по умолчанию отвечает только своему источнику. `weavix debug` кладёт
 * config.json в корень проекта, откуда он раздаётся как статика, поэтому
 * заголовки задаются на уровне сервера, а не отдельным обработчиком.
 */
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
};

/**
 * Каждый слот плагина — отдельная точка входа.
 * Имена html-файлов совпадают со значениями `entrypoint` в manifest.json:
 * entrypoint резолвится относительно каталога dist.
 */
export default defineConfig({
    // Плагин раздаётся из своего подкаталога в каталоге плагинов,
    // поэтому пути к ассетам должны быть относительными.
    base: './',
    server: {
        // Порт зашит в CLI (`PLUGIN_DEBUG_DOWNLOAD_BASE`), выбрать другой нельзя:
        // Трекер всё равно пойдёт за плагином на localhost:5173.
        port: 5173,
        strictPort: true,
        cors: true,
        headers: CORS_HEADERS,
    },
    plugins: [react()],
    build: {
        rollupOptions: {
            input: {
                'issue-block': 'issue-block.html',
                'queue-tab': 'queue-tab.html',
            },
        },
    },
});
