import { trackerApi } from '@weavix/tracker-plugin-sdk';

import type { TrackerField, TrackerIssue, TrackerQueue, Worklog } from './types';

/**
 * Все обращения к API Трекера собраны здесь.
 *
 * `trackerApi.v3` типизирован по OpenAPI, но набор путей зависит от версии
 * пакета, поэтому вызовы идут через узкий помощник с приведением типа:
 * при расхождении пути правка нужна ровно в одном месте, а не по всему коду.
 */
const api = trackerApi.v3 as unknown as {
    get: Record<string, (payload: unknown) => Promise<{ data: unknown }>>;
    post: Record<string, (payload: unknown) => Promise<{ data: unknown }>>;
};

const get = async <T>(path: string, payload: unknown): Promise<T> => {
    const { data } = await api.get[path](payload);

    return data as T;
};

const post = async <T>(path: string, payload: unknown): Promise<T> => {
    const { data } = await api.post[path](payload);

    return data as T;
};

/** Задача целиком: кастомные поля приходят по своим id. */
export const fetchIssue = (issueKey: string): Promise<TrackerIssue> =>
    get<TrackerIssue>('/issues/{id}', { pathParams: { id: issueKey } });

/** Ворклоги задачи — источник фактических трудозатрат. */
export const fetchWorklogs = (issueKey: string): Promise<Worklog[]> =>
    get<Worklog[]>('/issues/{id}/worklog', { pathParams: { id: issueKey } });

/**
 * Поля, доступные в очереди: глобальные и локальные.
 *
 * Глобальные берутся из `/fields`, а не из `/queues/{queueId}/fields`:
 * второй отдаёт лишь поля, настроенные на форме очереди, и молча теряет
 * остальные — в том числе поля оценок и исполнителей, которые в задачах
 * заполнены, но на форму не вынесены.
 *
 * Локальные приходят отдельным методом и имеют составной id вида
 * `<queueUuid>--<key>` — именно под этим ключом они лежат в задаче.
 */
export const fetchQueueFields = async (queueKey: string): Promise<TrackerField[]> => {
    const [global, local] = await Promise.all([
        get<TrackerField[]>('/fields', {}).catch(() => [] as TrackerField[]),
        get<TrackerField[]>('/queues/{queueId}/localFields', {
            pathParams: { queueId: queueKey },
        }).catch(() => [] as TrackerField[]),
    ]);

    const byId = new Map<string, TrackerField>();

    for (const field of [...global, ...local]) {
        if (field?.id) {
            byId.set(field.id, field);
        }
    }

    return [...byId.values()];
};

/**
 * Список очередей — нужен, чтобы скопировать настройки ролей из соседней очереди.
 * Ответ постраничный, поэтому страницы дочитываются, пока приходит полная.
 * Ограничение сверху — страховка от бесконечного цикла, а не оценка размера
 * организации: очередей больше тысячи в списке выбора всё равно не осмыслить.
 */
export const fetchQueues = async (): Promise<TrackerQueue[]> => {
    const perPage = 100;
    const queues: TrackerQueue[] = [];

    for (let page = 1; page <= 10; page += 1) {
        const chunk = await get<TrackerQueue[]>('/queues', {
            queryParams: { perPage, page },
        });

        queues.push(...chunk);

        if (chunk.length < perPage) {
            break;
        }
    }

    return queues;
};

/** Поиск задач по языку запросов Трекера. */
export const searchIssues = (
    query: string,
    perPage: number,
    page: number,
): Promise<TrackerIssue[]> =>
    post<TrackerIssue[]>('/issues/_search', {
        bodyParams: { query },
        queryParams: { perPage, page },
    });
