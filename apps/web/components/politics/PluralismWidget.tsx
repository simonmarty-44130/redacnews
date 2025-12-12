'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import {
  POLITICAL_FAMILIES,
  ELECTION_TYPES,
  type PoliticalFamilyCode,
  type ElectionTypeCode,
} from '@/lib/politics/config';
import { PoliticalBalanceBar, PoliticalLegend } from './PoliticalBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

interface PluralismWidgetProps {
  className?: string;
  showLegend?: boolean;
  days?: number;
}

export function PluralismWidget({
  className,
  showLegend = false,
  days: initialDays = 30,
}: PluralismWidgetProps) {
  const [days, setDays] = useState(initialDays);
  const [electionType, setElectionType] = useState<ElectionTypeCode | undefined>();

  const { data, isLoading, error } = trpc.politics.getQuickSummary.useQuery({
    days,
    electionType,
  });

  const balanceStats = useMemo(() => {
    if (!data) return [];

    const families = Object.keys(POLITICAL_FAMILIES) as PoliticalFamilyCode[];
    const totalTags = data.totalTags || 1;

    return families.map((family) => ({
      family,
      percentage: (data.familyCounts[family] / totalTags) * 100,
    }));
  }, [data]);

  // Déterminer la couleur du statut
  const statusColor = {
    balanced: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  };

  const statusIcon = {
    balanced: '✓',
    warning: '⚠️',
    danger: '🚨',
  };

  const statusLabel = {
    balanced: 'Équilibré',
    warning: 'Attention',
    danger: 'Déséquilibre',
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <p className="text-sm text-red-500">Erreur de chargement</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Pluralisme politique</CardTitle>
          {data && (
            <span className={`text-xs font-medium ${statusColor[data.status]}`}>
              {statusIcon[data.status]} {statusLabel[data.status]}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-20 flex items-center justify-center">
            <span className="text-sm text-gray-500">Chargement...</span>
          </div>
        ) : data ? (
          <>
            {/* Barre de répartition */}
            <PoliticalBalanceBar stats={balanceStats} height="md" />

            {/* Stats rapides */}
            <div className="flex justify-between text-xs text-gray-600">
              <span>{data.totalStories} sujets</span>
              <span>{data.totalTags} étiquettes</span>
              <span>{days} derniers jours</span>
            </div>

            {/* Alertes */}
            {data.alertCount > 0 && (
              <div className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                {data.alertCount} alerte{data.alertCount > 1 ? 's' : ''} de déséquilibre
              </div>
            )}

            {/* Filtres */}
            <div className="flex gap-2">
              <Select
                value={days.toString()}
                onValueChange={(v) => setDays(parseInt(v, 10))}
              >
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="90">90 jours</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={electionType || 'all'}
                onValueChange={(v) => setElectionType(v === 'all' ? undefined : (v as ElectionTypeCode))}
              >
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Toutes élections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {Object.entries(ELECTION_TYPES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.icon} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Légende si demandée */}
            {showLegend && <PoliticalLegend compact />}

            {/* Lien vers le tableau de bord complet */}
            <Link
              href="/pluralisme"
              className="block text-center text-xs text-blue-600 hover:text-blue-800 mt-2"
            >
              Voir le tableau de bord complet →
            </Link>
          </>
        ) : (
          <p className="text-sm text-gray-500">Aucune donnée</p>
        )}
      </CardContent>
    </Card>
  );
}

// Version compacte pour la barre latérale
interface PluralismMiniWidgetProps {
  className?: string;
}

export function PluralismMiniWidget({ className }: PluralismMiniWidgetProps) {
  const { data, isLoading } = trpc.politics.getQuickSummary.useQuery({
    days: 30,
  });

  const balanceStats = useMemo(() => {
    if (!data) return [];

    const families = Object.keys(POLITICAL_FAMILIES) as PoliticalFamilyCode[];
    const totalTags = data.totalTags || 1;

    return families.map((family) => ({
      family,
      percentage: (data.familyCounts[family] / totalTags) * 100,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className={className}>
        <div className="h-2 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const statusColor = {
    balanced: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  };

  return (
    <Link href="/pluralisme" className={`block ${className}`}>
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${statusColor[data.status]}`}
          title={`Pluralisme: ${data.status}`}
        />
        <div className="flex-1">
          <PoliticalBalanceBar stats={balanceStats} height="sm" />
        </div>
        {data.alertCount > 0 && (
          <span className="text-xs text-amber-600 font-medium">
            {data.alertCount}
          </span>
        )}
      </div>
    </Link>
  );
}
