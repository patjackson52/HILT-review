import { ReactNode } from 'react';
import type { RiskLevel } from '@hilt-review/shared';
import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | RiskLevel;

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  className,
}: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className || ''}`}>
      {children}
    </span>
  );
}

// Convenience component for risk level badges
interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export function RiskBadge({ level, className }: RiskBadgeProps) {
  return (
    <Badge variant={level} className={className}>
      {RISK_LABELS[level]}
    </Badge>
  );
}
