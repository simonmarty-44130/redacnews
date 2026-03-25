import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { db } from '@/lib/db';
import { createSlug } from '@/lib/utils';

// Interface pour les données du sujet
interface CreateStoryData {
  title: string;
  content?: string;
  category?: string;
  tags?: string[];
  estimatedDuration?: number; // en secondes
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authentifier l'utilisateur
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userId = user.id;
    const organizationId = user.organizationId;

    // 2. Récupérer les données de la requête
    const data: CreateStoryData = await req.json();

    if (!data.title) {
      return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 });
    }

    // 3. Créer le slug
    const slug = createSlug(data.title);

    // 4. Créer le sujet dans la base de données
    const story = await db.story.create({
      data: {
        title: data.title,
        slug,
        content: data.content || null,
        category: data.category || null,
        tags: data.tags || [],
        estimatedDuration: data.estimatedDuration || null,
        status: 'DRAFT',
        authorId: userId,
        organizationId: organizationId,
      },
    });

    // 5. Retourner le sujet créé avec l'URL
    return NextResponse.json({
      success: true,
      story: {
        id: story.id,
        title: story.title,
        url: `https://redacnews.link/sujets/${story.id}`,
      },
    });
  } catch (error: any) {
    console.error('Error creating story:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du sujet', details: error.message },
      { status: 500 }
    );
  }
}
