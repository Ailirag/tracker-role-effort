import { Label, Text } from '@gravity-ui/uikit';

import { formatHours } from '../core/duration';
import type { EffortBreakdown } from '../core/types';

interface Props {
    breakdown: EffortBreakdown;
    showUnattributed: boolean;
}

/** Отклонение факта от плана: до ±20% считаем попаданием в оценку. */
const ratioTheme = (ratio: number | null) => {
    if (ratio === null) {
        return 'unknown' as const;
    }

    if (ratio > 1.2) {
        return 'danger' as const;
    }

    if (ratio < 0.8) {
        return 'warning' as const;
    }

    return 'success' as const;
};

const cell: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--g-color-line-generic)',
    textAlign: 'right',
    whiteSpace: 'nowrap',
};

const nameCell: React.CSSProperties = { ...cell, textAlign: 'left' };

export const RoleEffortTable = ({ breakdown, showUnattributed }: Props) => {
    const { roles, unattributedHours, unattributedPerformers } = breakdown;

    if (roles.length === 0) {
        return (
            <Text color="secondary">
                Роли не настроены. Откройте вкладку «Трудозатраты по ролям» в очереди
                и задайте соответствие полей.
            </Text>
        );
    }

    return (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                <tr>
                    <th style={nameCell}>
                        <Text variant="subheader-1">Роль</Text>
                    </th>
                    <th style={cell}>
                        <Text variant="subheader-1">План</Text>
                    </th>
                    <th style={cell}>
                        <Text variant="subheader-1">Факт</Text>
                    </th>
                    <th style={cell}>
                        <Text variant="subheader-1">Отклонение</Text>
                    </th>
                    <th style={nameCell}>
                        <Text variant="subheader-1">Списывали время</Text>
                    </th>
                </tr>
            </thead>
            <tbody>
                {roles.map((role) => (
                    <tr key={role.roleId}>
                        <td style={nameCell}>
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: role.color,
                                    marginRight: 8,
                                }}
                            />
                            <Text>{role.title}</Text>
                        </td>
                        <td style={cell}>
                            <Text>{formatHours(role.planHours)}</Text>
                        </td>
                        <td style={cell}>
                            <Text>{formatHours(role.factHours)}</Text>
                        </td>
                        <td style={cell}>
                            {role.ratio === null ? (
                                <Text color="secondary">—</Text>
                            ) : (
                                <Label theme={ratioTheme(role.ratio)}>
                                    {`×${role.ratio.toFixed(2)}`}
                                </Label>
                            )}
                        </td>
                        <td style={nameCell}>
                            <Text color="secondary">
                                {role.performers.length > 0
                                    ? role.performers.join(', ')
                                    : '—'}
                            </Text>
                        </td>
                    </tr>
                ))}

                {showUnattributed && unattributedHours > 0 && (
                    <tr>
                        <td style={nameCell}>
                            <Text color="warning">Не распределено по ролям</Text>
                        </td>
                        <td style={cell}>
                            <Text color="secondary">—</Text>
                        </td>
                        <td style={cell}>
                            <Text color="warning">{formatHours(unattributedHours)}</Text>
                        </td>
                        <td style={cell}>
                            <Text color="secondary">—</Text>
                        </td>
                        <td style={nameCell}>
                            <Text color="secondary">
                                {unattributedPerformers.join(', ') || '—'}
                            </Text>
                        </td>
                    </tr>
                )}

                <tr>
                    <td style={nameCell}>
                        <Text variant="subheader-1">Итого</Text>
                    </td>
                    <td style={cell}>
                        <Text variant="subheader-1">
                            {formatHours(breakdown.totalPlanHours)}
                        </Text>
                    </td>
                    <td style={cell}>
                        <Text variant="subheader-1">
                            {formatHours(breakdown.totalFactHours)}
                        </Text>
                    </td>
                    <td style={cell}>
                        {breakdown.totalPlanHours > 0 ? (
                            <Label
                                theme={ratioTheme(
                                    breakdown.totalFactHours / breakdown.totalPlanHours,
                                )}
                            >
                                {`×${(
                                    breakdown.totalFactHours / breakdown.totalPlanHours
                                ).toFixed(2)}`}
                            </Label>
                        ) : (
                            <Text color="secondary">—</Text>
                        )}
                    </td>
                    <td style={nameCell} />
                </tr>
            </tbody>
        </table>
    );
};
