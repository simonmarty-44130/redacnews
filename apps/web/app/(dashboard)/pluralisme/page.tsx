'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  POLITICAL_FAMILIES,
  ELECTION_TYPES,
  type PoliticalFamilyCode,
  type ElectionTypeCode,
  formatDuration,
  formatDurationLong,
} from '@/lib/politics/config';
import {
  PoliticalBadge,
  PoliticalBalanceBar,
  PoliticalLegend,
  PoliticalDot,
} from '@/components/politics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type PeriodPreset = '7d' | '30d' | '90d' | 'custom';

export default function PluralismePage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d');
  const [electionType, setElectionType] = useState<ElectionTypeCode | undefined>();
  const [selectedFamily, setSelectedFamily] = useState<PoliticalFamilyCode | undefined>();
  const [selectedConstituency, setSelectedConstituency] = useState<string | undefined>();
  const [showAddCityDialog, setShowAddCityDialog] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [activeTab, setActiveTab] = useState<'global' | 'by-city'>('global');
  const [showDetailedDialog, setShowDetailedDialog] = useState(false);
  const [detailedFamily, setDetailedFamily] = useState<PoliticalFamilyCode | undefined>();

  // Calculer les dates en fonction de la période
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();

    switch (periodPreset) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }

    return { startDate: start, endDate: end };
  }, [periodPreset]);

  const utils = trpc.useUtils();

  // Récupérer les villes/circonscriptions
  const { data: constituencies } = trpc.politics.listConstituencies.useQuery();

  // Récupérer les statistiques d'équilibre (global ou par ville)
  const { data: balanceData, isLoading: loadingBalance } = trpc.politics.getBalance.useQuery({
    startDate,
    endDate,
    electionType,
    constituency: selectedConstituency,
  });

  // Récupérer les statistiques par ville
  const { data: balanceByCity, isLoading: loadingBalanceByCity } = trpc.politics.getBalanceByConstituency.useQuery({
    startDate,
    endDate,
    electionType,
  });

  // Mutation pour ajouter une ville
  const createConstituency = trpc.politics.createConstituency.useMutation({
    onSuccess: () => {
      utils.politics.listConstituencies.invalidate();
      setShowAddCityDialog(false);
      setNewCityName('');
    },
  });

  // Récupérer les sujets d'une famille sélectionnée
  const { data: familyStories, isLoading: loadingStories } = trpc.politics.getStoriesByFamily.useQuery(
    {
      family: selectedFamily!,
      startDate,
      endDate,
      electionType,
      limit: 20,
    },
    {
      enabled: !!selectedFamily,
    }
  );

  // Récupérer les sujets détaillés d'une famille (avec script)
  const { data: detailedStories, isLoading: loadingDetailed } = trpc.politics.getDetailedStoriesByFamily.useQuery(
    {
      family: detailedFamily!,
      startDate,
      endDate,
      electionType,
      constituency: selectedConstituency,
    },
    {
      enabled: !!detailedFamily && showDetailedDialog,
    }
  );

  // Export rapport
  const exportReport = trpc.politics.exportReport.useMutation();

  // Export rapport détaillé avec scripts
  const exportDetailedReport = trpc.politics.exportDetailedReport.useMutation();

  const handleExportDetailed = async (family?: PoliticalFamilyCode) => {
    const result = await exportDetailedReport.mutateAsync({
      family,
      startDate,
      endDate,
      electionType,
      constituency: selectedConstituency,
    });

    // Créer et télécharger le fichier
    const blob = new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    const result = await exportReport.mutateAsync({
      startDate,
      endDate,
      electionType,
      format,
    });

    // Créer et télécharger le fichier
    const blob = new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Formater le pourcentage avec couleur
  const getPercentageColor = (percentage: number, status: string) => {
    if (status === 'danger') return 'text-red-600 font-bold';
    if (status === 'warning') return 'text-amber-600 font-medium';
    return 'text-gray-700';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pluralisme Politique</h1>
          <p className="text-gray-600">
            Suivi de l'équilibre de la couverture politique (ARCOM)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={exportReport.isPending}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            disabled={exportReport.isPending}
          >
            Export JSON
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleExportDetailed()}
            disabled={exportDetailedReport.isPending}
          >
            {exportDetailedReport.isPending ? 'Export...' : 'Rapport ARCOM (avec scripts)'}
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Période */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Période:</span>
              <Select
                value={periodPreset}
                onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 derniers jours</SelectItem>
                  <SelectItem value="30d">30 derniers jours</SelectItem>
                  <SelectItem value="90d">90 derniers jours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type d'élection */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Élection:</span>
              <Select
                value={electionType || 'all'}
                onValueChange={(v) =>
                  setElectionType(v === 'all' ? undefined : (v as ElectionTypeCode))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Toutes les élections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les élections</SelectItem>
                  {Object.entries(ELECTION_TYPES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.icon} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtre par ville */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Ville:</span>
              <Select
                value={selectedConstituency || 'all'}
                onValueChange={(v) =>
                  setSelectedConstituency(v === 'all' ? undefined : v)
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Toutes les villes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les villes</SelectItem>
                  {constituencies?.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={showAddCityDialog} onOpenChange={setShowAddCityDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    + Ville
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajouter une ville</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Nom de la ville"
                      value={newCityName}
                      onChange={(e) => setNewCityName(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddCityDialog(false);
                          setNewCityName('');
                        }}
                      >
                        Annuler
                      </Button>
                      <Button
                        onClick={() => createConstituency.mutate({ name: newCityName, department: 'Loire-Atlantique' })}
                        disabled={!newCityName.trim() || createConstituency.isPending}
                      >
                        {createConstituency.isPending ? 'Ajout...' : 'Ajouter'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Dates affichées */}
            <div className="flex items-center gap-2 text-sm text-gray-500 ml-auto">
              Du {startDate.toLocaleDateString('fr-FR')} au{' '}
              {endDate.toLocaleDateString('fr-FR')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertes */}
      {balanceData && balanceData.alerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-medium text-amber-800">
                  Alertes de déséquilibre ({balanceData.alerts.length})
                </h3>
                <ul className="mt-2 space-y-1">
                  {balanceData.alerts.map((alert, i) => (
                    <li
                      key={i}
                      className={`text-sm ${
                        alert.type === 'danger' ? 'text-red-700 font-medium' : 'text-amber-700'
                      }`}
                    >
                      • {POLITICAL_FAMILIES[alert.family as PoliticalFamilyCode]?.label}:{' '}
                      {alert.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {balanceData?.totalStories || 0}
            </div>
            <div className="text-sm text-gray-600">Sujets politiques</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">
              {balanceData ? formatDurationLong(balanceData.totalSpeakingTime) : '00:00'}
            </div>
            <div className="text-sm text-gray-600">Temps de parole total</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div
              className={`text-3xl font-bold ${
                balanceData?.isBalanced ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {balanceData?.isBalanced ? '✓ Équilibré' : '✗ Déséquilibré'}
            </div>
            <div className="text-sm text-gray-600">Statut global</div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques et détails */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Répartition visuelle */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par famille politique</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBalance ? (
              <div className="h-40 flex items-center justify-center">
                <span className="text-gray-500">Chargement...</span>
              </div>
            ) : balanceData ? (
              <div className="space-y-4">
                {/* Barre de répartition */}
                <PoliticalBalanceBar
                  stats={balanceData.familyStats.map((s) => ({
                    family: s.family as PoliticalFamilyCode,
                    percentage: s.percentage,
                  }))}
                  height="lg"
                />

                {/* Légende interactive */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {balanceData.familyStats.map((stat) => {
                    const config = POLITICAL_FAMILIES[stat.family as PoliticalFamilyCode];
                    if (!config) return null;

                    return (
                      <button
                        key={stat.family}
                        onClick={() =>
                          setSelectedFamily(
                            selectedFamily === stat.family
                              ? undefined
                              : (stat.family as PoliticalFamilyCode)
                          )
                        }
                        className={`flex items-center gap-2 p-2 rounded hover:bg-gray-100 transition ${
                          selectedFamily === stat.family ? 'bg-gray-100 ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <PoliticalDot family={stat.family as PoliticalFamilyCode} />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">{config.shortLabel}</div>
                          <div className={`text-xs ${getPercentageColor(stat.percentage, stat.status)}`}>
                            {stat.percentage.toFixed(1)}% • {stat.storyCount} sujets
                          </div>
                        </div>
                        {stat.status !== 'ok' && (
                          <Badge
                            variant={stat.status === 'danger' ? 'destructive' : 'outline'}
                            className="text-xs"
                          >
                            {stat.status === 'danger' ? '!' : '?'}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center">
                <span className="text-gray-500">Aucune donnée</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Temps de parole */}
        <Card>
          <CardHeader>
            <CardTitle>Temps de parole par famille</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBalance ? (
              <div className="h-40 flex items-center justify-center">
                <span className="text-gray-500">Chargement...</span>
              </div>
            ) : balanceData ? (
              <div className="space-y-3">
                {balanceData.familyStats
                  .filter((s) => s.speakingTimeSeconds > 0)
                  .sort((a, b) => b.speakingTimeSeconds - a.speakingTimeSeconds)
                  .map((stat) => {
                    const config = POLITICAL_FAMILIES[stat.family as PoliticalFamilyCode];
                    if (!config) return null;

                    const maxTime = Math.max(
                      ...balanceData.familyStats.map((s) => s.speakingTimeSeconds)
                    );
                    const widthPercent = maxTime > 0
                      ? (stat.speakingTimeSeconds / maxTime) * 100
                      : 0;

                    return (
                      <div key={stat.family} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <PoliticalDot family={stat.family as PoliticalFamilyCode} />
                            <span>{config.shortLabel}</span>
                          </div>
                          <span className="font-mono">
                            {formatDurationLong(stat.speakingTimeSeconds)}
                          </span>
                        </div>
                        <div className="h-4 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${widthPercent}%`,
                              backgroundColor: config.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                {balanceData.familyStats.every((s) => s.speakingTimeSeconds === 0) && (
                  <p className="text-sm text-gray-500 text-center py-8">
                    Aucun temps de parole enregistré pour cette période
                  </p>
                )}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center">
                <span className="text-gray-500">Aucune donnée</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Détail par famille sélectionnée */}
      {selectedFamily && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <PoliticalDot family={selectedFamily} size="lg" />
                Sujets {POLITICAL_FAMILIES[selectedFamily].label}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailedFamily(selectedFamily);
                    setShowDetailedDialog(true);
                  }}
                >
                  Voir avec scripts
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportDetailed(selectedFamily)}
                  disabled={exportDetailedReport.isPending}
                >
                  {exportDetailedReport.isPending ? 'Export...' : 'Exporter ARCOM'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedFamily(undefined)}>
                  Fermer
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStories ? (
              <div className="py-8 text-center text-gray-500">Chargement...</div>
            ) : familyStories && familyStories.stories.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Auteur</TableHead>
                      <TableHead>Parti / Candidat</TableHead>
                      <TableHead className="text-right">Temps parole</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {familyStories.stories.map((story) => (
                      <TableRow key={story.id}>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(story.createdAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`/sujets/${story.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {story.title}
                          </a>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {[story.author.firstName, story.author.lastName]
                            .filter(Boolean)
                            .join(' ')}
                        </TableCell>
                        <TableCell>
                          {story.politicalTags.map((pt) => (
                            <span key={pt.id} className="text-sm">
                              {pt.politicalTag.partyName ||
                                pt.politicalTag.candidateName ||
                                POLITICAL_FAMILIES[selectedFamily].shortLabel}
                            </span>
                          ))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {story.politicalTags[0]?.speakingTime
                            ? formatDuration(story.politicalTags[0].speakingTime)
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {familyStories.hasMore && (
                  <div className="text-center py-4">
                    <span className="text-sm text-gray-500">
                      {familyStories.total - familyStories.stories.length} sujets supplémentaires
                    </span>
                  </div>
                )}
              </ScrollArea>
            ) : (
              <div className="py-8 text-center text-gray-500">
                Aucun sujet pour cette famille politique
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Synthèse par ville */}
      {balanceByCity && balanceByCity.constituencies.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Équilibre par ville</CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  {balanceByCity.summary.balancedCount} équilibré{balanceByCity.summary.balancedCount > 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  {balanceByCity.summary.warningCount} attention
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  {balanceByCity.summary.dangerCount} alerte{balanceByCity.summary.dangerCount > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {balanceByCity.constituencies.map((cityData) => (
                <Card
                  key={cityData.constituency.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    cityData.status === 'danger'
                      ? 'border-red-300 bg-red-50'
                      : cityData.status === 'warning'
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-green-200 bg-green-50'
                  }`}
                  onClick={() => setSelectedConstituency(cityData.constituency.name)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{cityData.constituency.name}</h3>
                      <Badge
                        variant={
                          cityData.status === 'danger'
                            ? 'destructive'
                            : cityData.status === 'warning'
                              ? 'outline'
                              : 'outline'
                        }
                        className={
                          cityData.status === 'balanced'
                            ? 'bg-green-100 text-green-700 border-green-300'
                            : cityData.status === 'warning'
                              ? 'bg-amber-100 text-amber-700 border-amber-300'
                              : ''
                        }
                      >
                        {cityData.status === 'balanced' && 'OK'}
                        {cityData.status === 'warning' && 'Attention'}
                        {cityData.status === 'danger' && 'Alerte'}
                      </Badge>
                    </div>

                    <div className="text-xs text-gray-600 mb-2">
                      {cityData.totalStories} sujet{cityData.totalStories > 1 ? 's' : ''} •{' '}
                      {formatDurationLong(cityData.totalSpeakingTime)}
                    </div>

                    {/* Mini barre de répartition */}
                    <PoliticalBalanceBar
                      stats={cityData.familyStats.map((s) => ({
                        family: s.family as PoliticalFamilyCode,
                        percentage: s.percentage,
                      }))}
                      height="sm"
                    />

                    {/* Alertes */}
                    {cityData.alertCount > 0 && (
                      <div className="mt-2 text-xs text-red-600">
                        {cityData.alertCount} alerte{cityData.alertCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau récapitulatif */}
      <Card>
        <CardHeader>
          <CardTitle>
            Tableau récapitulatif
            {selectedConstituency && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                — {selectedConstituency}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Famille politique</TableHead>
                <TableHead className="text-center">Sujets</TableHead>
                <TableHead className="text-center">Temps de parole</TableHead>
                <TableHead className="text-center">Pourcentage</TableHead>
                <TableHead className="text-center">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balanceData?.familyStats.map((stat) => {
                const config = POLITICAL_FAMILIES[stat.family as PoliticalFamilyCode];
                if (!config) return null;

                return (
                  <TableRow key={stat.family}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PoliticalDot family={stat.family as PoliticalFamilyCode} />
                        <span>{config.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{stat.storyCount}</TableCell>
                    <TableCell className="text-center font-mono">
                      {formatDurationLong(stat.speakingTimeSeconds)}
                    </TableCell>
                    <TableCell
                      className={`text-center ${getPercentageColor(stat.percentage, stat.status)}`}
                    >
                      {stat.percentage.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.status === 'ok' && (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          OK
                        </Badge>
                      )}
                      {stat.status === 'warning' && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700">
                          Attention
                        </Badge>
                      )}
                      {stat.status === 'danger' && (
                        <Badge variant="destructive">Alerte</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog pour afficher le listing détaillé avec scripts */}
      <Dialog open={showDetailedDialog} onOpenChange={setShowDetailedDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailedFamily && (
                <>
                  <PoliticalDot family={detailedFamily} size="lg" />
                  Listing détaillé - {POLITICAL_FAMILIES[detailedFamily].label}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailedStories && (
                <>
                  {detailedStories.totalStories} sujet(s) - Temps de parole total : {formatDurationLong(detailedStories.totalSpeakingTime)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-gray-500">
              Du {startDate.toLocaleDateString('fr-FR')} au {endDate.toLocaleDateString('fr-FR')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportDetailed(detailedFamily)}
              disabled={exportDetailedReport.isPending}
            >
              {exportDetailedReport.isPending ? 'Export...' : 'Exporter rapport ARCOM'}
            </Button>
          </div>

          <ScrollArea className="flex-1 pr-4">
            {loadingDetailed ? (
              <div className="py-8 text-center text-gray-500">Chargement...</div>
            ) : detailedStories && detailedStories.stories.length > 0 ? (
              <Accordion type="multiple" className="w-full">
                {detailedStories.stories.map((story, index) => (
                  <AccordionItem key={story.id} value={story.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-6">{index + 1}.</span>
                          <div className="text-left">
                            <div className="font-medium">{story.title}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(story.createdAt).toLocaleDateString('fr-FR')} - {story.author.name}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {story.politicalTags[0]?.isMainSubject && (
                            <Badge variant="outline" className="text-xs">Principal</Badge>
                          )}
                          <span className="font-mono text-sm">
                            {formatDuration(story.calculatedSpeakingTime)}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-9 space-y-4">
                        {/* Métadonnées */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Statut :</span>{' '}
                            <Badge variant="outline" className="text-xs">{story.status}</Badge>
                          </div>
                          {story.electionType && (
                            <div>
                              <span className="text-gray-500">Élection :</span>{' '}
                              {story.electionType}
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500">Parti/Candidat :</span>{' '}
                            {story.politicalTags.map((pt, i) => (
                              <span key={i}>
                                {pt.partyName || pt.candidateName || '-'}
                                {pt.constituency && ` [${pt.constituency}]`}
                              </span>
                            ))}
                          </div>
                          {story.googleDocUrl && (
                            <div>
                              <a
                                href={story.googleDocUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                Voir Google Docs
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Médias attachés */}
                        {story.media && story.media.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Médias attachés :</h4>
                            <ul className="text-sm space-y-1">
                              {story.media.map((m, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {m.type}
                                  </Badge>
                                  {m.title}
                                  {m.duration && (
                                    <span className="text-gray-500">
                                      ({formatDuration(m.duration)})
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Script / Contenu */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Script / Contenu :</h4>
                          {story.content ? (
                            <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                              {story.content}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              Pas de contenu textuel disponible
                              {story.googleDocUrl && ' - voir Google Docs'}
                            </p>
                          )}
                        </div>

                        {/* Lien vers le sujet */}
                        <div className="pt-2 border-t">
                          <a
                            href={`/sujets/${story.id}`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Ouvrir le sujet complet
                          </a>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="py-8 text-center text-gray-500">
                Aucun sujet pour cette famille politique
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
