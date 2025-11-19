import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, domain, type, limit = 25 } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    let results = [];

    if (type === 'semantic') {
      // AI Search - Semantic Search
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Vector search với pgvector
      const { data, error } = await supabase.rpc('match_sops', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: limit,
        filter_domain: domain || null,
      });

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      results = data || [];
    } else {
      // Keyword Search
      let supabaseQuery = supabase
        .from('sops')
        .select('*')
        .or(`title.ilike.%${query}%,primary_keywords.ilike.%${query}%,secondary_keywords.ilike.%${query}%`)
        .limit(limit);

      if (domain) {
        supabaseQuery = supabaseQuery.eq('domain', domain);
      }

      const { data, error } = await supabaseQuery;

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      // Thêm relevance_score giả cho keyword search
      results = (data || []).map((item: any) => ({
        ...item,
        relevance_score: 0.85, // Fixed score cho keyword search
      }));
    }

    // Format kết quả
    const formattedResults = results.map((item: any) => ({
      id: item.id,
      title: item.title,
      domain: item.domain,
      cause: item.cause,
      solution: {
        level1: item.solution_cs1,
        level2: item.solution_cs2,
      },
      link: item.link,
      last_updated: item.last_updated,
      relevance_score: item.relevance_score || item.similarity || 0.5,
    }));

    return NextResponse.json({
      success: true,
      results: formattedResults,
      count: formattedResults.length,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}