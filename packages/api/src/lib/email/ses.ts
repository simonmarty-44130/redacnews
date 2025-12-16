import {
  SESClient,
  SendEmailCommand,
} from '@aws-sdk/client-ses';

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'eu-west-3',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

/**
 * Sends a simple HTML email via AWS SES
 */
export async function sendEmail(options: SendEmailOptions): Promise<string> {
  const { to, subject, htmlBody, textBody, replyTo } = options;
  const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@redacnews.fr';
  const toAddresses = Array.isArray(to) ? to : [to];

  const command = new SendEmailCommand({
    Source: fromEmail,
    Destination: {
      ToAddresses: toAddresses,
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8',
        },
        ...(textBody && {
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        }),
      },
    },
    ...(replyTo && {
      ReplyToAddresses: [replyTo],
    }),
  });

  const response = await sesClient.send(command);
  return response.MessageId || '';
}

/**
 * Sends a rundown email to a guest
 */
export async function sendRundownEmail(options: {
  to: string;
  subject: string;
  htmlBody: string;
  replyTo?: string;
}): Promise<string> {
  return sendEmail({
    to: options.to,
    subject: options.subject,
    htmlBody: options.htmlBody,
    replyTo: options.replyTo,
  });
}
