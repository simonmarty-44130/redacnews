'use client';

import { useAssistant } from '@/hooks/useAssistant';
import { ChatMessageList } from '@/components/assistant/ChatMessageList';
import { ChatInput } from '@/components/assistant/ChatInput';
import { SystemPromptEditor } from '@/components/assistant/SystemPromptEditor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Trash2, Settings2, MessageSquare, Sparkles } from 'lucide-react';
import { useState } from 'react';

export default function AssistantPage() {
  const assistant = useAssistant();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Assistant IA</h1>
              <p className="text-sm text-gray-600">Votre assistant rédactionnel intelligent</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <Card className="shadow-xl border-0 overflow-hidden bg-white/80 backdrop-blur">
              <div className="p-4 border-b bg-white/50 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
                    {assistant.messages.length > 0 && (
                      <span className="text-sm text-gray-500">
                        ({assistant.messages.length} messages)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Settings2 className="h-4 w-4 mr-2" />
                      Paramètres
                    </Button>
                    {assistant.messages.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={assistant.newConversation}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Effacer
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {assistant.messages.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      Commencez une nouvelle conversation
                    </h3>
                    <p className="text-gray-600 max-w-md">
                      Posez vos questions, demandez de l'aide pour rédiger vos sujets, ou obtenez des
                      conseils sur votre travail rédactionnel.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-6 max-w-2xl">
                    <Button
                      variant="outline"
                      className="h-auto p-4 text-left flex flex-col items-start gap-2 hover:bg-blue-50 border-blue-200"
                      onClick={() =>
                        assistant.sendMessage(
                          "Aide-moi à rédiger un sujet radio de 1min30 sur l'actualité locale"
                        )
                      }
                    >
                      <span className="font-medium text-blue-700">Rédiger un sujet</span>
                      <span className="text-xs text-gray-600">
                        Obtenir de l'aide pour structurer et rédiger
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto p-4 text-left flex flex-col items-start gap-2 hover:bg-purple-50 border-purple-200"
                      onClick={() =>
                        assistant.sendMessage(
                          "Résume-moi les points clés d'un sujet pour un conducteur"
                        )
                      }
                    >
                      <span className="font-medium text-purple-700">Résumer</span>
                      <span className="text-xs text-gray-600">
                        Créer un résumé pour le conducteur
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto p-4 text-left flex-col items-start gap-2 hover:bg-green-50 border-green-200"
                      onClick={() =>
                        assistant.sendMessage(
                          "Vérifie l'orthographe et propose des améliorations stylistiques"
                        )
                      }
                    >
                      <span className="font-medium text-green-700">Corriger</span>
                      <span className="text-xs text-gray-600">
                        Vérifier orthographe et style
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto p-4 text-left flex flex-col items-start gap-2 hover:bg-orange-50 border-orange-200"
                      onClick={() =>
                        assistant.sendMessage(
                          "Comment adapter ce sujet pour un public plus large ?"
                        )
                      }
                    >
                      <span className="font-medium text-orange-700">Adapter</span>
                      <span className="text-xs text-gray-600">
                        Ajuster le ton et le contenu
                      </span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-[calc(100vh-20rem)]">
                  <ChatMessageList messages={assistant.messages} isStreaming={assistant.isStreaming} />
                </div>
              )}

              <div className="p-4 border-t bg-white/50 backdrop-blur">
                <ChatInput
                  onSend={assistant.sendMessage}
                  onStop={assistant.stopStreaming}
                  isStreaming={assistant.isStreaming}
                />
                {assistant.totalTokensUsed > 0 && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-4">
                    <span>Tokens utilisés: {assistant.totalTokensUsed.toLocaleString()}</span>
                    <span>•</span>
                    <span>
                      Entrée: {assistant.totalInputTokens.toLocaleString()} | Sortie:{' '}
                      {assistant.totalOutputTokens.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Settings Card */}
            {showSettings && (
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-gray-600" />
                    Paramètres
                  </h3>
                </div>
                <div className="p-4">
                  <Tabs defaultValue="prompt" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="prompt">Prompt</TabsTrigger>
                      <TabsTrigger value="model">Modèle</TabsTrigger>
                    </TabsList>
                    <TabsContent value="prompt" className="mt-4">
                      <SystemPromptEditor
                        value={assistant.systemPrompt}
                        onChange={assistant.setSystemPrompt}
                      />
                    </TabsContent>
                    <TabsContent value="model" className="mt-4">
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">
                          Modèle Claude
                        </label>
                        <select
                          value={assistant.model}
                          onChange={(e) => assistant.setModel(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                          <option value="claude-sonnet-4-5-20250929">
                            Sonnet 4.5 (Recommandé)
                          </option>
                          <option value="claude-opus-4-20250514">Opus 4 (Plus puissant)</option>
                          <option value="claude-3-5-sonnet-20241022">
                            Sonnet 3.5 (Économique)
                          </option>
                        </select>
                        <p className="text-xs text-gray-500">
                          Sonnet 4.5 offre le meilleur équilibre entre qualité et vitesse
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </Card>
            )}

            {/* Info Card */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">À propos</h3>
              </div>
              <div className="p-4 space-y-3 text-sm text-gray-600">
                <p>
                  L'assistant IA utilise <strong>Claude Sonnet 4.5</strong> d'Anthropic pour vous
                  aider dans votre travail rédactionnel.
                </p>
                <div className="space-y-2 pt-2">
                  <h4 className="font-medium text-gray-900">Fonctionnalités :</h4>
                  <ul className="space-y-1 text-xs">
                    <li>• Rédaction et amélioration de sujets</li>
                    <li>• Correction orthographique et stylistique</li>
                    <li>• Résumés et synthèses</li>
                    <li>• Conseils rédactionnels</li>
                    <li>• Support de pièces jointes (PDF, images)</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
