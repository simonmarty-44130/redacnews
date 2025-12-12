'use client';

import { cn } from '@/lib/utils';
import { POLITICAL_FAMILIES, type PoliticalFamilyCode } from '@/lib/politics/config';

interface PoliticalBadgeProps {
  family: PoliticalFamilyCode;
  partyName?: string | null;
  candidateName?: string | null;
  speakingTime?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  onClick?: () => void;
  onRemove?: () => void;
}

export function PoliticalBadge({
  family,
  partyName,
  candidateName,
  speakingTime,
  size = 'md',
  showLabel = true,
  className,
  onClick,
  onRemove,
}: PoliticalBadgeProps) {
  const config = POLITICAL_FAMILIES[family];

  if (!config) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  // Déterminer le texte à afficher
  let displayText: string = config.shortLabel;
  if (partyName) {
    displayText = partyName;
  } else if (candidateName) {
    displayText = candidateName;
  }

  // Formater le temps de parole
  const formattedTime = speakingTime
    ? `${Math.floor(speakingTime / 60)}:${(speakingTime % 60).toString().padStart(2, '0')}`
    : null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium border',
        sizeClasses[size],
        config.bgLight,
        config.textColor,
        config.borderColor,
        onClick && 'cursor-pointer hover:opacity-80',
        className
      )}
      style={{
        borderColor: config.color,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Indicateur coloré */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: config.color }}
      />

      {/* Label */}
      {showLabel && <span>{displayText}</span>}

      {/* Temps de parole */}
      {formattedTime && (
        <span className="text-xs opacity-75 ml-1">({formattedTime})</span>
      )}

      {/* Bouton supprimer */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:opacity-70 focus:outline-none"
          aria-label="Retirer"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
}

// Variante compacte pour les listes
interface PoliticalDotProps {
  family: PoliticalFamilyCode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PoliticalDot({ family, size = 'md', className }: PoliticalDotProps) {
  const config = POLITICAL_FAMILIES[family];

  if (!config) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={cn('rounded-full inline-block', sizeClasses[size], className)}
      style={{ backgroundColor: config.color }}
      title={config.label}
    />
  );
}

// Barre horizontale de répartition visuelle
interface PoliticalBalanceBarProps {
  stats: {
    family: PoliticalFamilyCode;
    percentage: number;
  }[];
  className?: string;
  height?: 'sm' | 'md' | 'lg';
}

export function PoliticalBalanceBar({
  stats,
  className,
  height = 'md',
}: PoliticalBalanceBarProps) {
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  // Filtrer les familles avec un pourcentage > 0
  const nonZeroStats = stats.filter((s) => s.percentage > 0);

  if (nonZeroStats.length === 0) {
    return (
      <div className={cn('bg-gray-200 rounded-full overflow-hidden', heightClasses[height], className)}>
        <div className="h-full w-full bg-gray-300" />
      </div>
    );
  }

  return (
    <div className={cn('flex rounded-full overflow-hidden', heightClasses[height], className)}>
      {nonZeroStats.map((stat) => {
        const config = POLITICAL_FAMILIES[stat.family];
        return (
          <div
            key={stat.family}
            className="h-full transition-all duration-300"
            style={{
              width: `${stat.percentage}%`,
              backgroundColor: config?.color || '#ccc',
            }}
            title={`${config?.label}: ${stat.percentage.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

// Légende des familles politiques
interface PoliticalLegendProps {
  families?: PoliticalFamilyCode[];
  className?: string;
  compact?: boolean;
}

export function PoliticalLegend({
  families,
  className,
  compact = false,
}: PoliticalLegendProps) {
  const displayFamilies = families || (Object.keys(POLITICAL_FAMILIES) as PoliticalFamilyCode[]);

  return (
    <div className={cn('flex flex-wrap gap-2', compact && 'gap-1', className)}>
      {displayFamilies.map((family) => {
        const config = POLITICAL_FAMILIES[family];
        return (
          <div key={family} className="flex items-center gap-1">
            <PoliticalDot family={family} size={compact ? 'sm' : 'md'} />
            <span className={cn('text-gray-600', compact ? 'text-xs' : 'text-sm')}>
              {config.shortLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
