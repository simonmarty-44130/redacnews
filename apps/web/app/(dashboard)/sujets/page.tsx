import { FileText } from 'lucide-react';

export default function SujetsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold">Sujets</h1>
      </div>
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-600">
          Le module Sujets vous permet de rediger et gerer vos sujets journalistiques.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Cette fonctionnalite sera disponible prochainement.
        </p>
      </div>
    </div>
  );
}
