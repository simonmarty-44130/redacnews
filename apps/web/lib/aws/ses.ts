import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
} from '@aws-sdk/client-ses';
import { awsConfig, sesConfig } from '../aws-config';

const sesClient = new SESClient({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

/**
 * Sends a simple HTML email via AWS SES
 */
export async function sendEmail(options: SendEmailOptions): Promise<string> {
  const { to, subject, htmlBody, textBody, replyTo } = options;
  const fromEmail = sesConfig.fromEmail;
  const toAddresses = Array.isArray(to) ? to : [to];

  // If there are attachments, use raw email
  if (options.attachments && options.attachments.length > 0) {
    return sendRawEmail(options);
  }

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
 * Sends a raw email with attachments via AWS SES
 */
async function sendRawEmail(options: SendEmailOptions): Promise<string> {
  const { to, subject, htmlBody, textBody, replyTo, attachments } = options;
  const fromEmail = sesConfig.fromEmail;
  const toAddresses = Array.isArray(to) ? to : [to];
  const boundary = `----=_Part_${Date.now().toString(36)}`;

  // Build the MIME message
  let rawMessage = '';

  // Headers
  rawMessage += `From: RédacNews <${fromEmail}>\r\n`;
  rawMessage += `To: ${toAddresses.join(', ')}\r\n`;
  if (replyTo) {
    rawMessage += `Reply-To: ${replyTo}\r\n`;
  }
  rawMessage += `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\n`;
  rawMessage += 'MIME-Version: 1.0\r\n';
  rawMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
  rawMessage += '\r\n';

  // Text/HTML body part
  rawMessage += `--${boundary}\r\n`;
  rawMessage += 'Content-Type: multipart/alternative; boundary="alt_boundary"\r\n';
  rawMessage += '\r\n';

  // Plain text version
  if (textBody) {
    rawMessage += '--alt_boundary\r\n';
    rawMessage += 'Content-Type: text/plain; charset=UTF-8\r\n';
    rawMessage += 'Content-Transfer-Encoding: quoted-printable\r\n';
    rawMessage += '\r\n';
    rawMessage += textBody + '\r\n';
  }

  // HTML version
  rawMessage += '--alt_boundary\r\n';
  rawMessage += 'Content-Type: text/html; charset=UTF-8\r\n';
  rawMessage += 'Content-Transfer-Encoding: quoted-printable\r\n';
  rawMessage += '\r\n';
  rawMessage += htmlBody + '\r\n';
  rawMessage += '--alt_boundary--\r\n';

  // Attachments
  if (attachments) {
    for (const attachment of attachments) {
      rawMessage += `--${boundary}\r\n`;
      rawMessage += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
      rawMessage += 'Content-Transfer-Encoding: base64\r\n';
      rawMessage += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
      rawMessage += '\r\n';
      rawMessage += attachment.content.toString('base64') + '\r\n';
    }
  }

  rawMessage += `--${boundary}--\r\n`;

  const command = new SendRawEmailCommand({
    RawMessage: {
      Data: Buffer.from(rawMessage),
    },
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
  attachments?: EmailAttachment[];
}): Promise<string> {
  return sendEmail({
    to: options.to,
    subject: options.subject,
    htmlBody: options.htmlBody,
    replyTo: options.replyTo,
    attachments: options.attachments,
  });
}
