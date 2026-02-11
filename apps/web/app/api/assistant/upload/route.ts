// Route API pour l'upload des pièces jointes de l'assistant

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getCurrentUser } from '@/lib/auth/get-current-user';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/html',
  'application/json',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    // Authentifier l'utilisateur
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Type de fichier non supporté: ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux (max 10 MB)' },
        { status: 400 }
      );
    }

    // Lire le fichier en buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload vers S3
    const key = `assistant-attachments/${user.organizationId}/${Date.now()}-${file.name}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    // Retourner les infos + le base64 pour envoi direct à l'API
    const base64 = buffer.toString('base64');
    const s3Url = `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${key}`;

    return NextResponse.json({
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      s3Key: key,
      s3Url,
      base64, // Pour envoi immédiat dans le chat
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Erreur upload' }, { status: 500 });
  }
}
