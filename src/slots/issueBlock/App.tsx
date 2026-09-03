import { useEffect, useState } from 'react';

import { Alert, Card, Spin, ThemeProvider } from '@gravity-ui/uikit';
import { useTrackerPluginContext } from '@weavix/tracker-plugin-sdk-react';

import { computeEffort } from '../../core/effort';
import { fetchIssue, fetchWorklogs } from '../../core/trackerClient';
import type { EffortBreakdown, TrackerIssue, Worklog } from '../../core/types';
import { useQueueSettings } from '../../core/useQueueSettings';
import { RoleEffortTable } from '../../ui/RoleEffortTable';

/** Ключ очереди лежит в задаче объектом `queue`, а до загрузки — в ключе задачи. */
const queueKeyOf = (issue: TrackerIssue | null, issueKey: string): string => {
    const queue = issue?.queue as { key?: string } | undefined;

    return queue?.key ?? issueKey.split('-')[0];
};

const App = () => {
    const { theme, slotContext } = useTrackerPluginContext<'issue.block'>();
    const issueKey = slotContext?.entityId ?? null;

    const [issue, setIssue] = useState<TrackerIssue | null>(null);
    const [worklogs, setWorklogs] = useState<Worklog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!issueKey) {
            setLoading(false);

            return;
        }

        let cancelled = false;

        setLoading(true);
        setError(null);

        Promise.all([fetchIssue(issueKey), fetchWorklogs(issueKey).catch(() => [])])
            .then(([loadedIssue, loadedWorklogs]) => {
                if (!cancelled) {
                    setIssue(loadedIssue);
                    setWorklogs(Array.isArray(loadedWorklogs) ? loadedWorklogs : []);
                    setLoading(false);
                }
            })
            .catch((cause: unknown) => {
                if (!cancelled) {
                    setError(cause instanceof Error ? cause.message : 'Не удалось загрузить задачу');
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [issueKey]);

    const queueKey = issueKey ? queueKeyOf(issue, issueKey) : null;
    const settingsState = useQueueSettings(queueKey);

    const isBusy = loading || settingsState.loading;

    let breakdown: EffortBreakdown | null = null;

    if (issue && settingsState.snapshot) {
        breakdown = computeEffort([{ issue, worklogs }], settingsState.snapshot.settings);
    }

    /**
     * Каждое состояние блока должно быть видимым. Пустой блок на карточке
     * неотличим от сломанного плагина, поэтому у ветвления есть замыкающая
     * ветка: молча не отрисоваться нельзя ни при каком раскладе.
     */
    const renderContent = () => {
        if (isBusy) {
            return <Spin size="m" />;
        }

        if (!issueKey) {
            return (
                <Alert
                    theme="warning"
                    title="Нет контекста задачи"
                    message="Трекер не передал ключ задачи. Перезагрузите страницу."
                />
            );
        }

        if (error) {
            return <Alert theme="danger" title="Ошибка загрузки задачи" message={error} />;
        }

        if (settingsState.error) {
            return (
                <Alert
                    theme="danger"
                    title="Не удалось загрузить настройки"
                    message={settingsState.error}
                />
            );
        }

        if (breakdown && settingsState.snapshot) {
            return (
                <RoleEffortTable
                    breakdown={breakdown}
                    showUnattributed={settingsState.snapshot.settings.showUnattributed}
                />
            );
        }

        return (
            <Alert
                theme="warning"
                title="Данные не загрузились"
                message="Задача или настройки очереди недоступны. Перезагрузите страницу."
            />
        );
    };

    return (
        <ThemeProvider theme={theme}>
            <Card style={{ padding: 16 }}>{renderContent()}</Card>
        </ThemeProvider>
    );
};

export default App;
