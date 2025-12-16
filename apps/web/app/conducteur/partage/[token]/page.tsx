'use client';

import { trpc } from '@/lib/trpc/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, Radio, AlertTriangle, Loader2 } from 'lucide-react';

interface PageProps {
  params: { token: string };
}

const typeBadgeClasses: Record<string, string> = {
  STORY: 'bg-blue-100 text-blue-800',
  INTERVIEW: 'bg-amber-100 text-amber-800',
  JINGLE: 'bg-indigo-100 text-indigo-800',
  MUSIC: 'bg-pink-100 text-pink-800',
  BREAK: 'bg-gray-100 text-gray-800',
  LIVE: 'bg-red-100 text-red-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

export default function SharedRundownPage({ params }: PageProps) {
  const { data, isLoading, error } = trpc.rundownGuest.getSharedRundown.useQuery(
    { token: params.token },
    {
      retry: false,
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement du conducteur...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Lien invalide ou expire
          </h1>
          <p className="text-gray-600">
            {error.message || "Ce lien de partage n'existe pas ou a expire."}
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl p-8 text-center">
          <Radio className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-3xl font-bold mb-2">{data.showName}</h1>
          <p className="text-xl opacity-90">{data.formattedDate}</p>
          <p className="text-sm mt-2 opacity-75">{data.organizationName}</p>
        </div>

        {/* Greeting */}
        <div className="bg-blue-50 p-6 border-x border-blue-100">
          <h2 className="text-xl font-semibold text-blue-900">
            Bonjour {data.recipientName},
          </h2>
          <p className="text-blue-700 mt-1">
            Voici le conducteur de l'emission. Vos passages sont indiques en
            jaune.
          </p>
        </div>

        {/* Rundown Table */}
        <div className="bg-white border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Heure
                </th>
                <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Element
                </th>
                <th className="text-right p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Duree
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-gray-100 ${
                    item.isHighlighted
                      ? 'bg-yellow-50 border-l-4 border-l-yellow-400'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="p-4 font-mono font-semibold text-blue-600">
                    {item.time}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase mr-2 ${
                        typeBadgeClasses[item.type] || typeBadgeClasses.OTHER
                      }`}
                    >
                      {item.typeLabel}
                    </span>
                    <span className="font-medium">{item.title}</span>
                    {item.isHighlighted && (
                      <span className="ml-2 bg-yellow-400 text-yellow-900 text-xs px-2 py-0.5 rounded font-semibold">
                        VOTRE PASSAGE
                      </span>
                    )}
                    {item.guestNames.length > 0 && (
                      <div className="text-sm text-gray-500 mt-1">
                        🎤 {item.guestNames.join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right font-mono text-gray-500">
                    {item.duration}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 rounded-b-xl p-6 border border-t-0 border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <strong>Duree totale :</strong> {data.totalDuration}
            </span>
            {data.expiresAt && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Ce lien expire le{' '}
                {format(new Date(data.expiresAt), 'd MMMM yyyy', { locale: fr })}
              </span>
            )}
          </div>
        </div>

        {/* Branding */}
        <div className="text-center mt-6 text-sm text-gray-400">
          Propulse par{' '}
          <a
            href="https://redacnews.link"
            className="text-blue-500 hover:underline"
          >
            RedacNews
          </a>
        </div>
      </div>
    </div>
  );
}
