import { useCallback, useEffect, useState } from 'react';

import {
    Alert,
    Button,
    Card,
    Select,
    Spin,
    Tab,
    TabList,
    TabProvider,
    Text,
    TextInput,
    ThemeProvider,
} from '@gravity-ui/uikit';
import { useTrackerPluginContext } from '@weavix/tracker-plugin-sdk-react';

import { aggregateQueue, type AggregateResult } from '../../core/aggregate';
import { computeEffort } from '../../core/effort';
import { loadSettings } from '../../core/settingsRepository';
import { fetchQueueFields, fetchQueues } from '../../core/trackerClient';
import type { QueueSettings, TrackerField, TrackerQueue } from '../../core/types';
import { useQueueAdmin } from '../../core/useQueueAdmin';
import { useQueueSettings } from '../../core/useQueueSettings';
import { RoleEffortTable } from '../../ui/RoleEffortTable';
import { SettingsForm } from '../../ui/SettingsForm';

const LIMITS = [
    { value: '25', content: '25 задач' },
    { value: '50', content: '50 задач' },
    { value: '100', content: '100 задач' },
];

const App = () => {
    const { theme, slotContext } = useTrackerPluginContext<'queue.tab'>();
    const queueKey = slotContext?.entityId ?? null;

    const [tab, setTab] = useState<'summary' | 'settings'>('summary');
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState('50');
    const [result, setResult] = useState<AggregateResult | null>(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fields, setFields] = useState<TrackerField[]>([]);
    const [queues, setQueues] = useState<TrackerQueue[]>([]);

    const settingsState = useQueueSettings(queueKey);
    const admin = useQueueAdmin(queueKey);

    /**
     * Пока право не подтверждено, вкладки «Настройки» нет, поэтому активной
     * может остаться только сводка — иначе после проверки экран оказался бы
     * на вкладке, которой больше не существует.
     */
    const activeTab = admin.isAdmin ? tab : 'summary';

    useEffect(() => {
        if (queueKey) {
            setQuery(`Queue: ${queueKey} Resolved: >= today() - "30d"`);
            fetchQueueFields(queueKey).then(setFields).catch(() => setFields([]));
        }
    }, [queueKey]);

    // Список очередей нужен только для копирования настроек и от очереди
    // не зависит, поэтому читается один раз.
    useEffect(() => {
        fetchQueues().then(setQueues).catch(() => setQueues([]));
    }, []);

    /** Настройки соседней очереди: null — там их не сохраняли. */
    const copyFrom = useCallback(async (sourceKey: string): Promise<QueueSettings | null> => {
        const snapshot = await loadSettings(sourceKey);

        return snapshot.isDefault ? null : snapshot.settings;
    }, []);

    const run = useCallback(async () => {
        setRunning(true);
        setError(null);

        try {
            setResult(await aggregateQueue(query, Number(limit)));
        } catch (cause: unknown) {
            setError(cause instanceof Error ? cause.message : 'Не удалось выполнить запрос');
        } finally {
            setRunning(false);
        }
    }, [query, limit]);

    const settings = settingsState.snapshot?.settings ?? null;
    const breakdown =
        result && settings ? computeEffort(result.entries, settings) : null;

    return (
        <ThemeProvider theme={theme}>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <TabProvider
                    value={activeTab}
                    onUpdate={(value: string) => setTab(value as 'summary' | 'settings')}
                >
                    <TabList>
                        <Tab value="summary">Сводка</Tab>
                        {/* Настройки — только для тех, кто администрирует очередь. */}
                        {admin.isAdmin && <Tab value="settings">Настройки</Tab>}
                    </TabList>
                </TabProvider>

                {(settingsState.loading || admin.loading) && <Spin size="m" />}

                {/*
                    Проверка прав не выполнилась — это не отказ в доступе, а сбой.
                    Вкладку настроек в таком случае не показываем, но причину
                    называем: иначе её пропажа выглядела бы как поломка плагина.
                */}
                {!admin.loading && admin.error && (
                    <Alert
                        theme="warning"
                        title="Не удалось проверить права на очередь"
                        message={`${admin.error}. Вкладка «Настройки» скрыта.`}
                    />
                )}

                {/*
                    Настройки не прочитались — без них вкладка «Настройки» пуста,
                    а сводка считается по несуществующим ролям. Показываем причину,
                    а не пустой экран.
                */}
                {!settingsState.loading && !settingsState.snapshot && (
                    <Alert
                        theme="danger"
                        title="Не удалось загрузить настройки"
                        message={
                            settingsState.error ??
                            'Трекер не передал ключ очереди. Перезагрузите страницу.'
                        }
                    />
                )}

                {!settingsState.loading && !admin.loading && activeTab === 'summary' && (
                    <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {settingsState.snapshot?.isDefault && (
                            <Alert
                                theme="info"
                                title="Роли не настроены"
                                message="Откройте вкладку «Настройки» и задайте соответствие полей для этой очереди."
                            />
                        )}

                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <TextInput
                                    label="Запрос"
                                    value={query}
                                    onUpdate={setQuery}
                                    placeholder='Queue: KEY Resolved: >= today() - "30d"'
                                />
                            </div>
                            <Select
                                value={[limit]}
                                options={LIMITS}
                                onUpdate={([value]) => setLimit(value)}
                            />
                            <Button view="action" loading={running} onClick={run}>
                                Посчитать
                            </Button>
                        </div>

                        {error && <Alert theme="danger" title="Ошибка" message={error} />}

                        {result?.truncated && (
                            <Alert
                                theme="warning"
                                title="Выборка ограничена"
                                message={`Загружено ${result.loaded} задач. Итоги посчитаны только по ним — уточните запрос или увеличьте лимит.`}
                            />
                        )}

                        {running && <Spin size="m" />}

                        {!running && breakdown && settings && (
                            <>
                                <Text color="secondary">
                                    {`Задач в расчёте: ${result?.loaded ?? 0}`}
                                </Text>
                                <RoleEffortTable
                                    breakdown={breakdown}
                                    showUnattributed={settings.showUnattributed}
                                />
                            </>
                        )}
                    </Card>
                )}

                {!settingsState.loading && !admin.loading && admin.isAdmin && activeTab === 'settings' && settings && (
                    <Card style={{ padding: 16 }}>
                        <SettingsForm
                            settings={settings}
                            fields={fields}
                            queueKey={queueKey}
                            queues={queues}
                            onCopyFrom={copyFrom}
                            // Право на очередь — обязательное условие: хранилище
                            // плагина о нём не знает и само бы пропустило.
                            canWrite={
                                admin.isAdmin && (settingsState.snapshot?.canWrite ?? false)
                            }
                            saving={settingsState.saving}
                            error={settingsState.error}
                            onSave={settingsState.save}
                        />
                    </Card>
                )}
            </div>
        </ThemeProvider>
    );
};

export default App;
