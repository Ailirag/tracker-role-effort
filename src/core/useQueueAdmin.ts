import { useEffect, useState } from 'react';

import { fetchMyself, fetchQueueGrantHolders } from './trackerClient';
import type { QueuePermissionHolders, TrackerMyself } from './types';

interface State {
    /** Есть ли у текущего пользователя право администрировать очередь. */
    isAdmin: boolean;
    loading: boolean;
    /** Проверку не удалось выполнить — это не то же самое, что «прав нет». */
    error: string | null;
}

const messageOf = (error: unknown): string =>
    error instanceof Error ? error.message : 'Неизвестная ошибка';

const asIdentity = (value: unknown): string | null =>
    value === undefined || value === null || value === '' ? null : String(value);

/** Один и тот же человек приходит из разных методов под разными полями. */
const identitiesOfMyself = (me: TrackerMyself): Set<string> =>
    new Set(
        [me.uid, me.trackerUid, me.login, me.passportUid, me.cloudUid]
            .map(asIdentity)
            .filter((value): value is string => value !== null),
    );

const isAmongHolders = (holders: QueuePermissionHolders, me: TrackerMyself): boolean => {
    const mine = identitiesOfMyself(me);

    return (holders.users ?? []).some((user) =>
        [user.id, user.key, user.passportUid, user.cloudUid]
            .map(asIdentity)
            .some((identity) => identity !== null && mine.has(identity)),
    );
};

/**
 * Право администрировать очередь — по нему доступны настройки плагина.
 *
 * Хранилище плагина живёт в контексте организации и о правах на очередь
 * ничего не знает, поэтому спрашиваем сам Трекер. Ошибка проверки трактуется
 * как отсутствие права: пускать по умолчанию нельзя, а чтобы отказ не выглядел
 * молчаливым, причина возвращается в `error` и показывается пользователю.
 */
export const useQueueAdmin = (queueKey: string | null): State => {
    const [state, setState] = useState<State>({
        isAdmin: false,
        loading: true,
        error: null,
    });

    useEffect(() => {
        if (!queueKey) {
            setState({ isAdmin: false, loading: false, error: null });

            return;
        }

        let cancelled = false;

        setState({ isAdmin: false, loading: true, error: null });

        const check = async () => {
            const me = await fetchMyself();
            // Логин — самая надёжная форма идентификатора для запроса:
            // он есть всегда, в отличие от паспортного и облачного uid.
            const user = me.login ?? asIdentity(me.uid);

            if (!user) {
                throw new Error('Не удалось определить текущего пользователя');
            }

            return isAmongHolders(await fetchQueueGrantHolders(queueKey, user), me);
        };

        check()
            .then((isAdmin) => {
                if (!cancelled) {
                    setState({ isAdmin, loading: false, error: null });
                }
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setState({ isAdmin: false, loading: false, error: messageOf(error) });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [queueKey]);

    return state;
};
