'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Music2,
  Clock,
  Layers,
  MoreHorizontal,
  Trash2,
  Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/client';

export default function AudioMontagePage() {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  // Charger les projets
  const { data: projects, isLoading, refetch } = trpc.montage.list.useQuery();

  // Mutations
  const createMutation = trpc.montage.create.useMutation({
    onSuccess: (project) => {
      router.push(`/audio-montage/${project.id}`);
    },
  });

  const deleteMutation = trpc.montage.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;

    createMutation.mutate({
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || undefined,
    });
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('Supprimer ce projet ? Cette action est irreversible.')) {
      deleteMutation.mutate({ id });
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Montage Audio</h1>
          <p className="text-muted-foreground">
            Creez et editez vos montages multipistes
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau projet
        </Button>
      </div>

      {/* Liste des projets */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="group hover:shadow-md transition-shadow cursor-pointer"
            >
              <Link href={`/audio-montage/${project.id}`}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Music2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      {project.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(`/audio-montage/${project.id}`);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteProject(project.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatDuration(project.duration)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Layers className="h-4 w-4" />
                      {project._count.tracks} piste
                      {project._count.tracks > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Modifie le {formatDate(project.updatedAt)}
                    {project.createdBy && (
                      <span>
                        {' '}
                        par {project.createdBy.firstName} {project.createdBy.lastName}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Music2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Aucun projet</h3>
              <p className="text-sm text-muted-foreground">
                Creez votre premier projet de montage multipiste
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Creer un projet
            </Button>
          </div>
        </Card>
      )}

      {/* Dialog de creation */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau projet</DialogTitle>
            <DialogDescription>
              Creez un nouveau projet de montage multipiste
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du projet</Label>
              <Input
                id="name"
                placeholder="Ex: Reportage Greve SNCF"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                placeholder="Description du projet..."
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creation...' : 'Creer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
