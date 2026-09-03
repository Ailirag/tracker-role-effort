import { parseDurationToHours, parseEstimateToHours, type DurationScale } from './duration';
import type {
    EffortBreakdown,
    QueueSettings,
    RoleConfig,
    RoleEffort,
    TrackerIssue,
    TrackerUser,
    Worklog,
} from './types';

/**
 * У пользователя в разных местах API разные идентификаторы (id, passportUid,
 * cloudUid), поэтому автора ворклога и значение поля-исполнителя сравниваем
 * по набору идентификаторов, а не по одному полю.
 */
const identitiesOf = (user: TrackerUser | undefined): string[] => {
    if (!user) {
        return [];
    }

    const ids: string[] = [];

    if (user.id !== undefined && user.id !== null) {
        ids.push(String(user.id));
    }

    if (user.passportUid !== undefined) {
        ids.push(String(user.passportUid));
    }

    if (user.cloudUid) {
        ids.push(user.cloudUid);
    }

    return ids;
};

const isUserLike = (value: unknown): value is TrackerUser =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** Поле-исполнитель может содержать как одного пользователя, так и массив. */
const usersFromField = (value: unknown): TrackerUser[] => {
    if (Array.isArray(value)) {
        return value.filter(isUserLike);
    }

    return isUserLike(value) ? [value] : [];
};

/** Собирает идентификаторы всех исполнителей роли, указанных в задаче. */
const roleIdentities = (issue: TrackerIssue, role: RoleConfig): Set<string> => {
    const identities = new Set<string>();

    for (const fieldId of role.performerFields) {
        for (const user of usersFromField(issue[fieldId])) {
            for (const identity of identitiesOf(user)) {
                identities.add(identity);
            }
        }
    }

    return identities;
};

interface Accumulator {
    planHours: number | null;
    factHours: number;
    performers: Set<string>;
}

const emptyAccumulator = (): Accumulator => ({
    planHours: null,
    factHours: 0,
    performers: new Set<string>(),
});

const addPlan = (accumulator: Accumulator, hours: number | null): void => {
    if (hours === null) {
        return;
    }

    accumulator.planHours = (accumulator.planHours ?? 0) + hours;
};

/**
 * Считает план и факт по ролям для набора задач.
 *
 * План берётся из настроенного числового поля роли.
 * Факт распределяется по ролям через автора ворклога: если автор указан
 * в поле-исполнителе роли, время относится к этой роли. Всё, что сопоставить
 * не удалось, попадает в отдельную корзину — так занижение факта по роли
 * остаётся видимым, а не растворяется в итогах.
 */
export const computeEffort = (
    entries: Array<{ issue: TrackerIssue; worklogs: Worklog[] }>,
    settings: QueueSettings,
): EffortBreakdown => {
    const scale: DurationScale = {
        hoursPerDay: settings.hoursPerDay,
        hoursPerWeek: settings.hoursPerWeek,
    };

    const accumulators = new Map<string, Accumulator>();

    for (const role of settings.roles) {
        accumulators.set(role.id, emptyAccumulator());
    }

    let unattributedHours = 0;
    const unattributedPerformers = new Set<string>();

    for (const { issue, worklogs } of entries) {
        const identitiesByRole = new Map<string, Set<string>>();

        for (const role of settings.roles) {
            identitiesByRole.set(role.id, roleIdentities(issue, role));

            if (role.estimateField) {
                addPlan(
                    accumulators.get(role.id)!,
                    parseEstimateToHours(issue[role.estimateField]),
                );
            }
        }

        for (const worklog of worklogs) {
            const hours = parseDurationToHours(worklog.duration, scale);

            if (hours === null) {
                continue;
            }

            const authorIdentities = identitiesOf(worklog.createdBy);
            const authorName = worklog.createdBy?.display ?? 'Неизвестный автор';

            const matchedRole = settings.roles.find((role) => {
                const identities = identitiesByRole.get(role.id);

                return (
                    identities !== undefined &&
                    authorIdentities.some((identity) => identities.has(identity))
                );
            });

            if (matchedRole) {
                const accumulator = accumulators.get(matchedRole.id)!;

                accumulator.factHours += hours;
                accumulator.performers.add(authorName);
            } else {
                unattributedHours += hours;
                unattributedPerformers.add(authorName);
            }
        }
    }

    const roles: RoleEffort[] = settings.roles.map((role) => {
        const accumulator = accumulators.get(role.id)!;
        const plan = accumulator.planHours;

        return {
            roleId: role.id,
            title: role.title,
            color: role.color,
            planHours: plan,
            factHours: accumulator.factHours,
            performers: [...accumulator.performers].sort(),
            ratio: plan && plan > 0 ? accumulator.factHours / plan : null,
        };
    });

    return {
        roles,
        unattributedHours,
        unattributedPerformers: [...unattributedPerformers].sort(),
        totalPlanHours: roles.reduce((sum, role) => sum + (role.planHours ?? 0), 0),
        totalFactHours:
            roles.reduce((sum, role) => sum + role.factHours, 0) + unattributedHours,
    };
};
