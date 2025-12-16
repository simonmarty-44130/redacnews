interface RundownItem {
  id: string;
  time: string;
  type: string;
  typeLabel: string;
  title: string;
  duration: string;
  durationSeconds: number;
  guestNames: string[];
  isHighlighted: boolean;
}

interface TemplateData {
  showName: string;
  organizationName: string;
  formattedDate: string;
  items: RundownItem[];
  totalDuration: string;
  recipientName: string;
  personalMessage?: string;
  totalGuestDuration: string;
  highlightedCount: number;
  senderName: string;
  webUrl?: string;
  contactEmail?: string;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function renderRundownGuestEmail(data: TemplateData): string {
  const itemsHtml = data.items
    .map((item) => {
      const highlightClass = item.isHighlighted ? 'highlighted' : '';
      const highlightBadge = item.isHighlighted
        ? '<span class="your-passage">VOTRE PASSAGE</span>'
        : '';

      const guestsHtml =
        item.guestNames.length > 0
          ? `<div class="guests">🎤 ${item.guestNames.join(', ')}</div>`
          : '';

      return `
      <tr class="${highlightClass}">
        <td class="time-cell">${item.time}</td>
        <td class="content-cell">
          <span class="type-badge type-${item.type}">${item.typeLabel}</span>
          <span class="title">${escapeHtml(item.title)}</span>
          ${highlightBadge}
          ${guestsHtml}
        </td>
        <td class="duration-cell">${item.duration}</td>
      </tr>
    `;
    })
    .join('');

  const personalMessageHtml = data.personalMessage
    ? `
      <div class="personal-message">
        <strong>Message de ${escapeHtml(data.senderName)} :</strong>
        <p>${escapeHtml(data.personalMessage)}</p>
      </div>
    `
    : '';

  const webLinkHtml = data.webUrl
    ? `
      <div class="web-link">
        <p>📱 Consultez ce conducteur en ligne :</p>
        <a href="${data.webUrl}" class="button">Voir le conducteur</a>
      </div>
    `
    : '';

  const highlightSummary =
    data.highlightedCount > 0
      ? `
      <div class="highlight-summary">
        <strong>📍 Vos interventions :</strong> ${data.highlightedCount} passage(s) —
        <strong>Duree totale : ${data.totalGuestDuration}</strong>
      </div>
    `
      : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conducteur - ${escapeHtml(data.showName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6; padding: 20px; }
    .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 32px 24px; text-align: center; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header .subtitle { font-size: 18px; opacity: 0.9; }
    .header .org { font-size: 14px; opacity: 0.8; margin-top: 8px; }
    .greeting { padding: 24px; background: #f0f9ff; border-bottom: 1px solid #e0f2fe; }
    .greeting h2 { font-size: 18px; color: #0369a1; margin-bottom: 8px; }
    .personal-message { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 24px; border-radius: 0 8px 8px 0; }
    .personal-message strong { color: #b45309; }
    .personal-message p { margin-top: 8px; color: #92400e; }
    .highlight-summary { background: #fef9c3; border: 2px solid #facc15; padding: 16px 24px; margin: 16px 24px; border-radius: 8px; text-align: center; font-size: 15px; }
    .highlight-summary strong { color: #a16207; }
    .content { padding: 24px; }
    .rundown-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .rundown-table thead th { background: #f9fafb; padding: 12px 16px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    .rundown-table tbody tr { border-bottom: 1px solid #f3f4f6; }
    .rundown-table tbody tr.highlighted { background: #fef9c3 !important; border-left: 4px solid #eab308; }
    .rundown-table tbody tr.highlighted td:first-child { padding-left: 12px; }
    .time-cell { padding: 14px 16px; font-family: monospace; font-weight: 600; color: #3b82f6; white-space: nowrap; width: 70px; }
    .content-cell { padding: 14px 16px; }
    .duration-cell { padding: 14px 16px; font-family: monospace; color: #6b7280; white-space: nowrap; text-align: right; width: 60px; }
    .type-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 8px; }
    .type-STORY { background: #dbeafe; color: #1d4ed8; }
    .type-INTERVIEW { background: #fef3c7; color: #b45309; }
    .type-JINGLE { background: #e0e7ff; color: #4338ca; }
    .type-MUSIC { background: #fce7f3; color: #be185d; }
    .type-BREAK { background: #f3f4f6; color: #6b7280; }
    .type-LIVE { background: #fee2e2; color: #dc2626; }
    .type-OTHER { background: #f3f4f6; color: #6b7280; }
    .title { font-weight: 500; }
    .your-passage { display: inline-block; background: #fbbf24; color: #78350f; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-left: 8px; }
    .guests { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .summary { background: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 14px; }
    .summary strong { color: #374151; }
    .web-link { text-align: center; padding: 24px; background: #f0fdf4; border-top: 1px solid #dcfce7; }
    .web-link p { margin-bottom: 12px; color: #166534; }
    .button { display: inline-block; background: #22c55e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6; }
    .footer a { color: #3b82f6; text-decoration: none; }
    .legend { padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
    .legend h4 { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
    .legend-item { display: inline-block; margin-right: 16px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📻 ${escapeHtml(data.showName)}</h1>
      <div class="subtitle">${escapeHtml(data.formattedDate)}</div>
      <div class="org">${escapeHtml(data.organizationName)}</div>
    </div>
    <div class="greeting">
      <h2>Bonjour ${escapeHtml(data.recipientName)},</h2>
      <p>Voici le conducteur de l'emission a laquelle vous participez.</p>
    </div>
    ${personalMessageHtml}
    ${highlightSummary}
    <div class="content">
      <table class="rundown-table">
        <thead>
          <tr>
            <th>Heure</th>
            <th>Element</th>
            <th>Duree</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>
    <div class="summary">
      <span><strong>Duree totale de l'emission :</strong> ${data.totalDuration}</span>
    </div>
    <div class="legend">
      <h4>Legende</h4>
      <span class="legend-item"><span class="type-badge type-STORY">Sujet</span> Reportage</span>
      <span class="legend-item"><span class="type-badge type-INTERVIEW">Interview</span> Echange</span>
      <span class="legend-item"><span class="type-badge type-LIVE">Direct</span> En direct</span>
      <span class="legend-item"><span class="type-badge type-BREAK">Pub</span> Publicite</span>
    </div>
    ${webLinkHtml}
    <div class="footer">
      <p>Ce conducteur vous a ete envoye par ${escapeHtml(data.senderName)}.<br><em>Les lignes en jaune indiquent vos passages a l'antenne.</em></p>
      <p style="margin-top: 12px;">Propulse par <a href="https://redacnews.link">RedacNews</a></p>
    </div>
  </div>
</body>
</html>
  `;
}
