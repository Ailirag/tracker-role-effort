import { storageApi, type StorageRecord } from '@weavix/tracker-plugin-sdk';

import type { QueueSettings } from './types';

const BUCKET = 'role-effort';
const SCHEMA_VERSION = 1;

/**
 * Настройки хранятся отдельно для каждой очереди, поэтому один и тот же
 * плагин работает в организациях с разными схемами полей.
 *
 * Хранилище платформы в текущей версии SDK даёт только контекст организации
 * (`storageApi.orgShared`), поэтому очередь кодируется в имени бакета
 * (`role-effort.<КЛЮЧ_ОЧЕРЕДИ>`).
 * В более новых версиях появляется контекст сущности (`resource`) — он
 * подхватывается автоматически, если доступен, без изменения формата данных.
 */
type Backend = 'resource' | 'orgShared';

interface ResourceStorage {
    get: (options: { resourceId: string; bucket?: string }) => Promise<StorageRecord | null>;
    patch: (options: {
        resourceId: string;
        bucket?: string;
        data: Record<string, unknown>;
        version?: number;
    }) => Promise<StorageRecord>;
}

/** Контекст `resource` есть не во всех версиях SDK — определяем его в рантайме. */
const resourceStorage = (storageApi as unknown as { resource?: ResourceStorage }).resource;

export interface SettingsSnapshot {
    settings: QueueSettings;
    /** Версия записи для оптимистичной блокировки при сохранении. */
    version: number;
    /** Есть ли у текущего пользователя право записи. */
    canWrite: boolean;
    /** Настройки ещё ни разу не сохранялись — показываем значения по умолчанию. */
    isDefault: boolean;
    backend: Backend;
}

export const createDefaultSettings = (): QueueSettings => ({
    schemaVersion: SCHEMA_VERSION,
    roles: [],
    hoursPerDay: 8,
    hoursPerWeek: 40,
    showUnattributed: true,
});

/**
 * Хранилище проверяет имя бакета схемой: допустимы только A-Z, a-z, 0-9, точка,
 * подчёркивание и дефис, длина до 64 символов. Поэтому очередь отделяется
 * точкой, а всё непредусмотренное в ключе заменяется на подчёркивание —
 * иначе запрос отвергается валидацией ещё до обращения к хранилищу.
 */
const orgBucketFor = (queueKey: string): string =>
    `${BUCKET}.${queueKey.replace(/[^A-Za-z0-9._-]/g, '_')}`.slice(0, 64);

/** Приводит запись из хранилища к настройкам, отбрасывая незнакомую структуру. */
const normalize = (data: Record<string, unknown> | undefined): QueueSettings | null => {
    if (!data || typeof data !== 'object' || !Array.isArray(data.roles)) {
        return null;
    }

    const defaults = createDefaultSettings();

    return {
        schemaVersion:
            typeof data.schemaVersion === 'number' ? data.schemaVersion : SCHEMA_VERSION,
        roles: data.roles as QueueSettings['roles'],
        hoursPerDay: typeof data.hoursPerDay === 'number' ? data.hoursPerDay : defaults.hoursPerDay,
        hoursPerWeek:
            typeof data.hoursPerWeek === 'number' ? data.hoursPerWeek : defaults.hoursPerWeek,
        showUnattributed:
            typeof data.showUnattributed === 'boolean'
                ? data.showUnattributed
                : defaults.showUnattributed,
    };
};

const toSnapshot = (record: StorageRecord | null, backend: Backend): SettingsSnapshot => {
    const settings = record ? normalize(record.data) : null;

    return {
        settings: settings ?? createDefaultSettings(),
        version: record?.version ?? 0,
        canWrite: record?.canWrite ?? true,
        isDefault: settings === null,
        backend,
    };
};

export const loadSettings = async (queueKey: string): Promise<SettingsSnapshot> => {
    if (resourceStorage) {
        try {
            const record = await resourceStorage.get({
                resourceId: queueKey,
                bucket: BUCKET,
            });

            return toSnapshot(record, 'resource');
        } catch {
            // Контекст сущности недоступен — используем хранилище организации.
        }
    }

    const record = await storageApi.orgShared.get(orgBucketFor(queueKey));

    return toSnapshot(record, 'orgShared');
};

export const saveSettings = async (
    queueKey: string,
    settings: QueueSettings,
    snapshot: SettingsSnapshot,
): Promise<SettingsSnapshot> => {
    const data = { ...settings, schemaVersion: SCHEMA_VERSION } as unknown as Record<
        string,
        unknown
    >;

    if (snapshot.backend === 'resource' && resourceStorage) {
        const record = await resourceStorage.patch({
            resourceId: queueKey,
            bucket: BUCKET,
            data,
            version: snapshot.version,
        });

        return toSnapshot(record, 'resource');
    }

    const record = await storageApi.orgShared.patch({
        bucket: orgBucketFor(queueKey),
        data,
        version: snapshot.version,
    });

    return toSnapshot(record, 'orgShared');
};
