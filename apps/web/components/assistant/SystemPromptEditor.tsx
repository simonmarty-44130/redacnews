'use client';

import { useState } from 'react';
import { useAssistant } from '@/hooks/useAssistant';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

export function SystemPromptEditor() {
  const { systemPrompt, setSystemPrompt } = useAssistant();
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);

  const handleSave = () => {
    setSystemPrompt(localPrompt);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="space-y-1">
        <Label htmlFor="system-prompt">Consigne système personnalisée</Label>
        <p className="text-xs text-muted-foreground">
          Ces instructions seront ajoutées au prompt de base de l'assistant
        </p>
      </div>
      <Textarea
        id="system-prompt"
        value={localPrompt}
        onChange={(e) => setLocalPrompt(e.target.value)}
        placeholder="Ex: Tu es un expert en actualité locale française..."
        className="min-h-[100px] font-mono text-xs"
      />
      <Button onClick={handleSave} size="sm" className="w-full">
        <Save className="h-3 w-3 mr-2" />
        Sauvegarder
      </Button>
    </div>
  );
}
