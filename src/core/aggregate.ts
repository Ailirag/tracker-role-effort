import { fetchIssue, fetchWorklogs, searchIssues } from './trackerClient';
import type { TrackerIssue, Worklog } from './types';

export interface AggregateResult {
    entries: Array<{ issue: TrackerIssue; worklogs: Worklog[] }>;
    /** Сколько задач нашлось всего до применения лимита. */
    found: number;
    /** Сколько задач реально загружено. */
    loaded: number;
    /** true — выборка обрезана лимитом, итоги неполные. */
    truncated: boolean;
}

/** Выполняет задачи пачками, чтобы не упереться в лимиты API. */
const mapWithConcurrency = async <T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>,
): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;

            results[index] = await worker(items[index]);
        }
    });

    await Promise.all(runners);

    return results;
};

/**
 * Собирает данные по очереди.
 *
 * Массовый поиск не возвращает пользовательские поля ролей — их отдаёт только
 * запрос одной задачи. Поэтому после поиска каждая задача догружается отдельно,
 * и объём выборки приходится ограничивать: превышение лимита возвращается
 * флагом `truncated`, чтобы неполные итоги не выглядели полными.
 */
export const aggregateQueue = async (
    query: string,
    limit: number,
): Promise<AggregateResult> => {
    const perPage = Math.min(limit, 100);
    const found = await searchIssues(query, perPage, 1);
    const keys = found
        .map((issue) => issue.key)
        .filter((key): key is string => typeof key === 'string')
        .slice(0, limit);

    const entries = await mapWithConcurrency(keys, 5, async (key) => {
        const [issue, worklogs] = await Promise.all([
            fetchIssue(key),
            fetchWorklogs(key).catch(() => [] as Worklog[]),
        ]);

        return { issue, worklogs: Array.isArray(worklogs) ? worklogs : [] };
    });

    return {
        entries,
        found: found.length,
        loaded: entries.length,
        truncated: found.length > keys.length || found.length === perPage,
    };
};
