import { useMemo, useRef, useState } from 'react';

import { Alert, Button, Checkbox, Select, Text, TextInput } from '@gravity-ui/uikit';

import type { QueueSettings, RoleConfig, TrackerField, TrackerQueue } from '../core/types';

const PALETTE = ['#4E8FF7', '#6FCF97', '#F2C94C', '#BB6BD9', '#EB5757', '#56CCF2'];

/** Числовые поля годятся под оценку в часах. */
const isNumericField = (field: TrackerField): boolean =>
    field.schema?.type === 'float' || field.schema?.type === 'integer';

/** Поля-пользователи (одиночные и массивы) годятся под исполнителя роли. */
const isUserField = (field: TrackerField): boolean =>
    field.schema?.type === 'user' ||
    (field.schema?.type === 'array' && field.schema?.items === 'user');

const toOptions = (fields: TrackerField[]) =>
    fields
        .map((field) => ({ value: field.id, content: `${field.name} (${field.id})` }))
        .sort((a, b) => a.content.localeCompare(b.content, 'ru'));

/**
 * Поля из скопированных настроек, которых в этой очереди нет.
 *
 * Глобальные поля общие для организации, а локальные — свои у каждой очереди,
 * поэтому часть соответствий после копирования может указывать в пустоту.
 * Молча потерять их нельзя: роль осталась бы без плана или без исполнителей,
 * и это выглядело бы как неверный расчёт.
 */
const unknownFieldIds = (settings: QueueSettings, fields: TrackerField[]): string[] => {
    const known = new Set(fields.map((field) => field.id));
    const used = settings.roles.flatMap((role) => [
        ...(role.estimateField ? [role.estimateField] : []),
        ...role.performerFields,
    ]);

    return [...new Set(used.filter((id) => !known.has(id)))];
};

interface Notice {
    theme: 'info' | 'warning' | 'danger';
    title: string;
    message: string;
}

interface Props {
    settings: QueueSettings;
    fields: TrackerField[];
    /** Ключ текущей очереди — её саму копировать не из чего. */
    queueKey: string | null;
    queues: TrackerQueue[];
    /** Читает настройки другой очереди; null — там ничего не сохраняли. */
    onCopyFrom: (queueKey: string) => Promise<QueueSettings | null>;
    canWrite: boolean;
    saving: boolean;
    error: string | null;
    onSave: (settings: QueueSettings) => void;
}

export const SettingsForm = ({
    settings,
    fields,
    queueKey,
    queues,
    onCopyFrom,
    canWrite,
    saving,
    error,
    onSave,
}: Props) => {
    const [draft, setDraft] = useState<QueueSettings>(settings);
    const [copySource, setCopySource] = useState<string[]>([]);
    const [copying, setCopying] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);
    const rolesRef = useRef<HTMLDivElement>(null);

    const numericOptions = useMemo(() => toOptions(fields.filter(isNumericField)), [fields]);
    const userOptions = useMemo(() => toOptions(fields.filter(isUserField)), [fields]);

    const queueOptions = useMemo(
        () =>
            queues
                .filter((queue) => queue.key !== queueKey)
                .map((queue) => ({
                    value: queue.key,
                    content: queue.name ? `${queue.name} (${queue.key})` : queue.key,
                }))
                .sort((a, b) => a.content.localeCompare(b.content, 'ru')),
        [queues, queueKey],
    );

    /**
     * Копирование только заполняет форму: сохранение остаётся отдельным
     * действием, иначе чужие настройки затирали бы текущие одним кликом.
     */
    const copyFromQueue = async () => {
        const [sourceKey] = copySource;

        if (!sourceKey) {
            return;
        }

        setCopying(true);
        setNotice(null);

        try {
            const copied = await onCopyFrom(sourceKey);

            if (!copied) {
                setNotice({
                    theme: 'warning',
                    title: 'Копировать нечего',
                    message: `В очереди ${sourceKey} настройки ролей не сохранялись.`,
                });

                return;
            }

            setDraft(copied);

            const unknown = unknownFieldIds(copied, fields);

            setNotice(
                unknown.length === 0
                    ? {
                          theme: 'info',
                          title: 'Настройки скопированы',
                          message: `Роли из ${sourceKey} подставлены в форму. Проверьте и сохраните.`,
                      }
                    : {
                          theme: 'warning',
                          title: 'Скопировано, но не все поля существуют',
                          message: `В этой очереди нет полей: ${unknown.join(', ')}. Задайте их заново, иначе роль останется без данных.`,
                      },
            );
        } catch (cause: unknown) {
            setNotice({
                theme: 'danger',
                title: 'Не удалось скопировать',
                message: cause instanceof Error ? cause.message : 'Неизвестная ошибка',
            });
        } finally {
            setCopying(false);
        }
    };

    const updateRole = (index: number, patch: Partial<RoleConfig>) => {
        setDraft((current) => ({
            ...current,
            roles: current.roles.map((role, i) => (i === index ? { ...role, ...patch } : role)),
        }));
    };

    const addRole = () => {
        setDraft((current) => ({
            ...current,
            roles: [
                ...current.roles,
                {
                    id: `role-${Date.now()}`,
                    title: 'Новая роль',
                    estimateField: null,
                    performerFields: [],
                    color: PALETTE[current.roles.length % PALETTE.length],
                },
            ],
        }));

        // Новая карточка добавляется в конец прокручиваемого списка: без
        // подкрутки к ней кажется, что кнопка ничего не сделала.
        requestAnimationFrame(() => {
            const list = rolesRef.current;

            if (list) {
                list.scrollTop = list.scrollHeight;
            }
        });
    };

    const removeRole = (index: number) => {
        setDraft((current) => ({
            ...current,
            roles: current.roles.filter((_, i) => i !== index),
        }));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
            {/*
                Кнопка сохранения стоит вверху осознанно: слот встроен в страницу
                Трекера, и при большом числе ролей низ формы уходит за границу
                видимой области — снизу до кнопки было не добраться.
            */}
            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Text variant="header-1">Соответствие полей</Text>
                <Button
                    view="action"
                    disabled={!canWrite || saving}
                    loading={saving}
                    onClick={() => onSave(draft)}
                >
                    Сохранить
                </Button>
            </div>
            <Text color="secondary">
                Настройки сохраняются отдельно для этой очереди. Для каждой роли укажите
                поле с оценкой в часах и поля, по которым определяется исполнитель —
                по ним трудозатраты распределяются между ролями.
            </Text>

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <Select
                    label="Скопировать из очереди"
                    disabled={!canWrite || queueOptions.length === 0}
                    filterable
                    width={340}
                    value={copySource}
                    options={queueOptions}
                    onUpdate={setCopySource}
                />
                <Button
                    view="outlined"
                    disabled={!canWrite || copySource.length === 0 || copying}
                    loading={copying}
                    onClick={copyFromQueue}
                >
                    Скопировать
                </Button>
            </div>

            {notice && (
                <Alert theme={notice.theme} title={notice.title} message={notice.message} />
            )}

            {!canWrite && (
                <Alert
                    theme="warning"
                    title="Только просмотр"
                    message="У вас нет прав на изменение настроек этой очереди."
                />
            )}

            {error && <Alert theme="danger" title="Не удалось сохранить" message={error} />}

            {/*
                Список ролей прокручивается сам: иначе форма растёт по числу ролей
                без ограничений, а прокрутки у встроенного слота нет.
                Высота задана в пикселях намеренно — от `vh` авторесайз слота
                зациклился бы: высота содержимого задаёт высоту окна и наоборот.
            */}
            <div
                ref={rolesRef}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    maxHeight: 420,
                    overflowY: 'auto',
                    // поля ввода у краёв не должны обрезаться полосой прокрутки
                    padding: 2,
                }}
            >
                {draft.roles.map((role, index) => (
                    <div
                        key={role.id}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            padding: 12,
                            border: '1px solid var(--g-color-line-generic)',
                            borderRadius: 8,
                        }}
                    >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    background: role.color,
                                }}
                            />
                            <TextInput
                                value={role.title}
                                disabled={!canWrite}
                                placeholder="Название роли"
                                onUpdate={(title) => updateRole(index, { title })}
                            />
                            <Button
                                view="flat-danger"
                                disabled={!canWrite}
                                onClick={() => removeRole(index)}
                            >
                                Удалить
                            </Button>
                        </div>

                        <Select
                            label="Поле оценки (часы)"
                            disabled={!canWrite}
                            value={role.estimateField ? [role.estimateField] : []}
                            options={numericOptions}
                            filterable
                            onUpdate={([value]) =>
                                updateRole(index, { estimateField: value ?? null })
                            }
                        />

                        <Select
                            label="Поля исполнителя"
                            disabled={!canWrite}
                            multiple
                            filterable
                            value={role.performerFields}
                            options={userOptions}
                            onUpdate={(performerFields) => updateRole(index, { performerFields })}
                        />
                    </div>
                ))}
            </div>

            <div>
                <Button view="outlined" disabled={!canWrite} onClick={addRole}>
                    Добавить роль
                </Button>
            </div>

            <Text variant="header-1">Перевод длительностей</Text>
            <Text color="secondary">
                Трекер хранит трудозатраты в рабочих днях и неделях. Укажите, сколько
                часов они содержат в вашей организации.
            </Text>

            <div style={{ display: 'flex', gap: 12 }}>
                <TextInput
                    label="Часов в дне"
                    type="number"
                    disabled={!canWrite}
                    value={String(draft.hoursPerDay)}
                    onUpdate={(value) =>
                        setDraft((current) => ({
                            ...current,
                            hoursPerDay: Number(value) || current.hoursPerDay,
                        }))
                    }
                />
                <TextInput
                    label="Часов в неделе"
                    type="number"
                    disabled={!canWrite}
                    value={String(draft.hoursPerWeek)}
                    onUpdate={(value) =>
                        setDraft((current) => ({
                            ...current,
                            hoursPerWeek: Number(value) || current.hoursPerWeek,
                        }))
                    }
                />
            </div>

            <Checkbox
                checked={draft.showUnattributed}
                disabled={!canWrite}
                onUpdate={(showUnattributed) =>
                    setDraft((current) => ({ ...current, showUnattributed }))
                }
            >
                Показывать трудозатраты, не отнесённые ни к одной роли
            </Checkbox>
        </div>
    );
};
