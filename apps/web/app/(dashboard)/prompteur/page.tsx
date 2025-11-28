import { Presentation } from 'lucide-react';

export default function PrompteurPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Presentation className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold">Prompteur</h1>
      </div>
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-600">
          Le Prompteur affiche vos scripts en mode plein ecran pour la presentation a l'antenne.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Cette fonctionnalite sera disponible prochainement.
        </p>
      </div>
    </div>
  );
}
