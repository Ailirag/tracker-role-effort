/** Идентификатор роли внутри настроек очереди. */
export type RoleId = string;

/**
 * Описание одной роли: какое поле хранит оценку в часах
 * и какие поля указывают на исполнителей этой роли.
 */
export interface RoleConfig {
    id: RoleId;
    title: string;
    /** id числового поля, в котором хранится оценка роли в часах. */
    estimateField: string | null;
    /**
     * id полей типа «пользователь», по которым определяется исполнитель роли.
     * Ворклог относится к роли, если его автор совпал с любым из этих полей
     * задачи.
     */
    performerFields: string[];
    /** Цвет для визуального различения роли. */
    color: string;
}

/** Настройки плагина для конкретной очереди. */
export interface QueueSettings {
    schemaVersion: number;
    roles: RoleConfig[];
    /** Сколько часов в рабочем дне — для перевода ISO-длительностей (P1D). */
    hoursPerDay: number;
    /** Сколько часов в рабочей неделе — для перевода ISO-длительностей (P1W). */
    hoursPerWeek: number;
    /**
     * Если true — ворклоги, автора которых не удалось сопоставить ни с одной
     * ролью, показываются отдельной строкой, а не растворяются в итогах.
     */
    showUnattributed: boolean;
}

/** Поле очереди в том виде, в каком его отдаёт API Трекера. */
export interface TrackerField {
    id: string;
    name: string;
    key?: string;
    schema?: {
        type?: string;
        items?: string | null;
    };
}

/** Очередь в списке выбора — для копирования настроек между очередями. */
export interface TrackerQueue {
    key: string;
    name?: string;
}

/** Пользователь в полях задачи и в ворклогах. */
export interface TrackerUser {
    id?: string | number;
    display?: string;
    passportUid?: number;
    cloudUid?: string;
}

/** Ворклог задачи. */
export interface Worklog {
    id?: number;
    /** ISO-8601 длительность, например `P1DT2H30M`. */
    duration?: string;
    createdBy?: TrackerUser;
    comment?: string;
    start?: string;
}

/** Задача с произвольным набором полей (кастомные поля приходят по своим id). */
export type TrackerIssue = Record<string, unknown> & {
    key?: string;
    summary?: string;
};

/** Результат расчёта по одной роли. */
export interface RoleEffort {
    roleId: RoleId;
    title: string;
    color: string;
    /** Плановые часы из поля оценки (null — поле не задано или пусто). */
    planHours: number | null;
    /** Фактические часы, собранные из ворклогов. */
    factHours: number;
    /** Кто фактически списывал время в этой роли. */
    performers: string[];
    /** Факт / план. null — если плана нет или он равен нулю. */
    ratio: number | null;
}

/** Полный результат расчёта по задаче или по набору задач. */
export interface EffortBreakdown {
    roles: RoleEffort[];
    /** Часы, которые не удалось отнести ни к одной роли. */
    unattributedHours: number;
    /** Авторы нераспределённых ворклогов. */
    unattributedPerformers: string[];
    totalPlanHours: number;
    totalFactHours: number;
}
