"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchVectors = void 0;
const supabase_1 = require("@langchain/community/vectorstores/supabase");
const openai_1 = require("@langchain/openai");
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const openAIApiKey = process.env.OPENAI_API_KEY;
const embeddings = new openai_1.OpenAIEmbeddings({ openAIApiKey });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseApiKey = process.env.SUPABASE_KEY;
const searchVectors = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseApiKey);
    const vectorStore = new supabase_1.SupabaseVectorStore(embeddings, {
        client,
        tableName: 'documents',
        queryName: 'match_documents',
    });
    console.log("Petición de vectores");
    const results = yield vectorStore.similaritySearch(query, 4);
    const combineDocuments = (results) => {
        return results.map((doc) => doc.pageContent).join('\n\n');
    };
    // console.log(combineDocuments(results));
    return combineDocuments(results);
});
exports.searchVectors = searchVectors;
