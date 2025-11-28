import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  DeleteTranscriptionJobCommand,
  TranscriptionJob,
} from '@aws-sdk/client-transcribe';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const transcribeClient = new TranscribeClient({
  region: process.env.AWS_REGION || 'eu-west-3',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-3',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface TranscriptionResult {
  jobName: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  transcription?: string;
  error?: string;
}

/**
 * Starts a transcription job for an audio/video file
 */
export async function startTranscription(
  mediaItemId: string,
  s3Key: string,
  languageCode: string = 'fr-FR'
): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET || 'redacnews-media';
  const jobName = `redacnews-${mediaItemId}-${Date.now()}`;

  await transcribeClient.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: languageCode,
      Media: {
        MediaFileUri: `s3://${bucket}/${s3Key}`,
      },
      OutputBucketName: bucket,
      OutputKey: `transcriptions/${mediaItemId}.json`,
      Settings: {
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: 10,
        ShowAlternatives: false,
      },
    })
  );

  return jobName;
}

/**
 * Gets the status of a transcription job
 */
export async function getTranscriptionStatus(
  jobName: string
): Promise<TranscriptionResult> {
  const response = await transcribeClient.send(
    new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName,
    })
  );

  const job = response.TranscriptionJob;

  if (!job) {
    throw new Error('Transcription job not found');
  }

  const status = job.TranscriptionJobStatus as TranscriptionResult['status'];

  if (status === 'FAILED') {
    return {
      jobName,
      status,
      error: job.FailureReason || 'Unknown error',
    };
  }

  if (status === 'COMPLETED' && job.Transcript?.TranscriptFileUri) {
    // Get the transcription text from S3
    const transcription = await getTranscriptionText(job);
    return {
      jobName,
      status,
      transcription,
    };
  }

  return {
    jobName,
    status,
  };
}

/**
 * Gets the transcription text from the S3 output file
 */
async function getTranscriptionText(job: TranscriptionJob): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET || 'redacnews-media';

  // Extract the output key from the job
  const outputKey = job.Transcript?.TranscriptFileUri?.split(`${bucket}/`)[1];

  if (!outputKey) {
    throw new Error('Could not determine transcription output location');
  }

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: outputKey,
    })
  );

  const bodyString = await response.Body?.transformToString();

  if (!bodyString) {
    throw new Error('Empty transcription result');
  }

  const transcriptionData = JSON.parse(bodyString);

  // Extract the plain text from AWS Transcribe output format
  const transcripts = transcriptionData.results?.transcripts;

  if (transcripts && transcripts.length > 0) {
    return transcripts.map((t: any) => t.transcript).join('\n\n');
  }

  return '';
}

/**
 * Deletes a transcription job
 */
export async function deleteTranscriptionJob(jobName: string): Promise<void> {
  await transcribeClient.send(
    new DeleteTranscriptionJobCommand({
      TranscriptionJobName: jobName,
    })
  );
}

/**
 * Gets transcription with speaker labels (for interview segmentation)
 */
export async function getTranscriptionWithSpeakers(
  jobName: string
): Promise<{ speaker: string; text: string; startTime: number; endTime: number }[]> {
  const response = await transcribeClient.send(
    new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName,
    })
  );

  const job = response.TranscriptionJob;

  if (!job || job.TranscriptionJobStatus !== 'COMPLETED') {
    return [];
  }

  const bucket = process.env.AWS_S3_BUCKET || 'redacnews-media';
  const outputKey = job.Transcript?.TranscriptFileUri?.split(`${bucket}/`)[1];

  if (!outputKey) {
    return [];
  }

  const s3Response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: outputKey,
    })
  );

  const bodyString = await s3Response.Body?.transformToString();

  if (!bodyString) {
    return [];
  }

  const transcriptionData = JSON.parse(bodyString);
  const items = transcriptionData.results?.items || [];
  const segments: { speaker: string; text: string; startTime: number; endTime: number }[] = [];

  let currentSpeaker = '';
  let currentText = '';
  let segmentStart = 0;
  let segmentEnd = 0;

  for (const item of items) {
    if (item.type === 'pronunciation') {
      const speaker = item.speaker_label || 'spk_0';
      const text = item.alternatives?.[0]?.content || '';
      const startTime = parseFloat(item.start_time || '0');
      const endTime = parseFloat(item.end_time || '0');

      if (speaker !== currentSpeaker && currentText) {
        segments.push({
          speaker: currentSpeaker,
          text: currentText.trim(),
          startTime: segmentStart,
          endTime: segmentEnd,
        });
        currentText = '';
        segmentStart = startTime;
      }

      if (!currentText) {
        segmentStart = startTime;
      }

      currentSpeaker = speaker;
      currentText += ` ${text}`;
      segmentEnd = endTime;
    } else if (item.type === 'punctuation') {
      currentText += item.alternatives?.[0]?.content || '';
    }
  }

  // Add the last segment
  if (currentText) {
    segments.push({
      speaker: currentSpeaker,
      text: currentText.trim(),
      startTime: segmentStart,
      endTime: segmentEnd,
    });
  }

  return segments;
}

/**
 * Supported audio/video formats for transcription
 */
export const TRANSCRIBABLE_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/ogg',
];

export function isTranscribable(mimeType: string): boolean {
  return TRANSCRIBABLE_MIME_TYPES.includes(mimeType.toLowerCase());
}
