/**
 * Трекер отдаёт трудозатраты в формате ISO-8601 (`P1W2DT3H30M`),
 * где неделя и день измеряются в рабочем времени, а не в календарном.
 * Поэтому коэффициенты перевода вынесены в настройки очереди.
 */

const ISO_DURATION = /^P(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/;

export interface DurationScale {
    hoursPerDay: number;
    hoursPerWeek: number;
}

const toNumber = (value: string | undefined): number =>
    value ? Number.parseFloat(value.replace(',', '.')) : 0;

/**
 * Переводит ISO-8601 длительность в часы.
 * Возвращает null, если строка пустая или не распознана —
 * молча считать её нулём нельзя, иначе факт будет занижен без предупреждения.
 */
export const parseDurationToHours = (
    value: unknown,
    scale: DurationScale,
): number | null => {
    if (typeof value !== 'string' || value.length === 0) {
        return null;
    }

    const match = ISO_DURATION.exec(value.trim());

    if (!match) {
        return null;
    }

    const [, weeks, days, hours, minutes, seconds] = match;

    return (
        toNumber(weeks) * scale.hoursPerWeek +
        toNumber(days) * scale.hoursPerDay +
        toNumber(hours) +
        toNumber(minutes) / 60 +
        toNumber(seconds) / 3600
    );
};

/** Приводит значение числового поля оценки к часам. */
export const parseEstimateToHours = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number.parseFloat(value.replace(',', '.'));

        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
};

/** Формат для вывода в интерфейсе: 7.5 → «7,5 ч». */
export const formatHours = (hours: number | null): string => {
    if (hours === null) {
        return '—';
    }

    const rounded = Math.round(hours * 10) / 10;

    return `${rounded.toLocaleString('ru-RU')} ч`;
};
