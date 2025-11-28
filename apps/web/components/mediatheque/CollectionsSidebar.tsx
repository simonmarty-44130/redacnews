'use client';

import { useState } from 'react';
import {
  FolderOpen,
  Plus,
  ChevronRight,
  Folder,
  Music,
  Image,
  Video,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

interface CollectionsSidebarProps {
  selectedCollectionId: string | null;
  onSelectCollection: (collectionId: string | null) => void;
  selectedType: string;
  onSelectType: (type: string) => void;
}

const COLORS = [
  { value: '#3B82F6', label: 'Bleu' },
  { value: '#10B981', label: 'Vert' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#EF4444', label: 'Rouge' },
  { value: '#8B5CF6', label: 'Violet' },
  { value: '#EC4899', label: 'Rose' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#14B8A6', label: 'Teal' },
];

export function CollectionsSidebar({
  selectedCollectionId,
  onSelectCollection,
  selectedType,
  onSelectType,
}: CollectionsSidebarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');

  const utils = trpc.useUtils();

  const { data: collections, isLoading } = trpc.media.listCollections.useQuery();

  const createCollection = trpc.media.createCollection.useMutation({
    onSuccess: () => {
      utils.media.listCollections.invalidate();
      setIsDialogOpen(false);
      setNewName('');
      setNewDescription('');
      setNewColor('#3B82F6');
    },
  });

  const handleCreateCollection = () => {
    if (!newName.trim()) return;
    createCollection.mutate({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      color: newColor,
    });
  };

  const typeFilters = [
    { value: 'all', label: 'Tous', icon: FolderOpen },
    { value: 'AUDIO', label: 'Audio', icon: Music },
    { value: 'VIDEO', label: 'Video', icon: Video },
    { value: 'IMAGE', label: 'Images', icon: Image },
    { value: 'DOCUMENT', label: 'Documents', icon: FileText },
  ];

  return (
    <div className="w-56 border-r bg-gray-50 flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-6">
          {/* Types de fichiers */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
              Types
            </h3>
            {typeFilters.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.value}
                  onClick={() => onSelectType(filter.value)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    selectedType === filter.value
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>

          {/* Collections */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Collections
              </h3>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nouvelle collection</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom</Label>
                      <Input
                        id="name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Ex: Virgules, Jingles, ITW..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (optionnel)</Label>
                      <Input
                        id="description"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Description de la collection"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Couleur</Label>
                      <div className="flex gap-2 flex-wrap">
                        {COLORS.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setNewColor(color.value)}
                            className={cn(
                              'w-8 h-8 rounded-full transition-transform',
                              newColor === color.value && 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                            )}
                            style={{ backgroundColor: color.value }}
                            title={color.label}
                          />
                        ))}
                      </div>
                    </div>
                    <Button
                      onClick={handleCreateCollection}
                      disabled={!newName.trim() || createCollection.isPending}
                      className="w-full"
                    >
                      {createCollection.isPending ? 'Creation...' : 'Creer la collection'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Toutes les collections */}
            <button
              onClick={() => onSelectCollection(null)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                selectedCollectionId === null
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <FolderOpen className="h-4 w-4" />
              <span>Toutes</span>
            </button>

            {/* Liste des collections */}
            {isLoading ? (
              <div className="px-2 py-4 text-xs text-gray-400">Chargement...</div>
            ) : collections && collections.length > 0 ? (
              collections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => onSelectCollection(collection.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    selectedCollectionId === collection.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Folder
                    className="h-4 w-4"
                    style={{ color: collection.color }}
                  />
                  <span className="flex-1 truncate text-left">{collection.name}</span>
                  <span className="text-xs text-gray-400">
                    {collection._count?.items || 0}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-2 py-4 text-xs text-gray-400">
                Aucune collection
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
