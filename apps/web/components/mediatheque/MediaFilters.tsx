'use client';

import { Search, X, Grid, List, Music, Image, Video, File } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Filters {
  search: string;
  type: string;
}

interface MediaFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'Tous', icon: null },
  { value: 'AUDIO', label: 'Audio', icon: Music },
  { value: 'VIDEO', label: 'Video', icon: Video },
  { value: 'IMAGE', label: 'Images', icon: Image },
  { value: 'DOCUMENT', label: 'Docs', icon: File },
];

export function MediaFilters({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
}: MediaFiltersProps) {
  const hasFilters = filters.search || filters.type !== 'all';

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      type: 'all',
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Rechercher..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="pl-9"
        />
      </div>

      {/* Type filters */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {TYPE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange({ ...filters, type: opt.value })}
            className={cn(
              'h-8 px-3',
              filters.type === opt.value
                ? 'bg-white shadow-sm'
                : 'hover:bg-gray-200'
            )}
          >
            {opt.icon && <opt.icon className="h-4 w-4 mr-1.5" />}
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Effacer
        </Button>
      )}

      {/* View mode toggle */}
      <div className="flex items-center gap-1 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onViewModeChange('grid')}
          className={cn('h-8 w-8', viewMode === 'grid' && 'bg-gray-100')}
        >
          <Grid className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onViewModeChange('list')}
          className={cn('h-8 w-8', viewMode === 'list' && 'bg-gray-100')}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
