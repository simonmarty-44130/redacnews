import {
  SESClient,
  SendEmailCommand,
} from '@aws-sdk/client-ses';
import { awsConfig, sesConfig } from '../aws-config';

const sesClient = new SESClient({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
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
  const fromEmail = sesConfig.fromEmail;
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
