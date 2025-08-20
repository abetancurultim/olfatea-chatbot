import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { OpenAIEmbeddings } from '@langchain/openai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const openAIApiKey = process.env.OPENAI_API_KEY;

const embeddings = new OpenAIEmbeddings({ openAIApiKey });
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseApiKey = process.env.SUPABASE_KEY as string;

export const searchVectors = async (query: string) => {
    const client = createClient(supabaseUrl, supabaseApiKey);

    const vectorStore = new SupabaseVectorStore(embeddings, {
        client,
        tableName: 'documents',
        queryName: 'match_documents',
    });
    console.log("Petición de vectores");

    const results = await vectorStore.similaritySearch(query, 4);
    
    const combineDocuments = (results: any[]) => {
        return results.map((doc: { pageContent: any; }) => doc.pageContent).join('\n\n');
    }

    // console.log(combineDocuments(results));

    return combineDocuments(results);
}