import { useCallback, useEffect, useState } from 'react';

import {
    loadSettings,
    saveSettings,
    type SettingsSnapshot,
} from './settingsRepository';
import type { QueueSettings } from './types';

interface State {
    snapshot: SettingsSnapshot | null;
    loading: boolean;
    saving: boolean;
    error: string | null;
}

const messageOf = (error: unknown): string =>
    error instanceof Error ? error.message : 'Неизвестная ошибка';

/** Загружает и сохраняет настройки ролей для очереди. */
export const useQueueSettings = (queueKey: string | null) => {
    const [state, setState] = useState<State>({
        snapshot: null,
        loading: true,
        saving: false,
        error: null,
    });

    useEffect(() => {
        if (!queueKey) {
            // Грузить нечего, но ожидание надо снять: иначе слот, не получивший
            // контекст от Трекера, навсегда останется на спиннере.
            setState({ snapshot: null, loading: false, saving: false, error: null });

            return;
        }

        let cancelled = false;

        setState((current) => ({ ...current, loading: true, error: null }));

        loadSettings(queueKey)
            .then((snapshot) => {
                if (!cancelled) {
                    setState({ snapshot, loading: false, saving: false, error: null });
                }
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setState({
                        snapshot: null,
                        loading: false,
                        saving: false,
                        error: messageOf(error),
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [queueKey]);

    const save = useCallback(
        async (settings: QueueSettings) => {
            if (!queueKey || !state.snapshot) {
                return;
            }

            setState((current) => ({ ...current, saving: true, error: null }));

            try {
                const snapshot = await saveSettings(queueKey, settings, state.snapshot);

                setState({ snapshot, loading: false, saving: false, error: null });
            } catch (error: unknown) {
                // Чаще всего это конфликт версий: настройки изменил кто-то ещё,
                // поэтому перечитываем актуальную запись, чтобы не затереть её.
                const fresh = await loadSettings(queueKey).catch(() => null);

                setState((current) => ({
                    snapshot: fresh ?? current.snapshot,
                    loading: false,
                    saving: false,
                    error: messageOf(error),
                }));
            }
        },
        [queueKey, state.snapshot],
    );

    return { ...state, save };
};
