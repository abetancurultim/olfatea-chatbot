import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { 
  createPetTool, 
  updateProfileTool, 
  createLostPetAlertTool, 
  getOwnerPetsOptimizedTool,
  updatePetTool,
  createFoundPetSightingTool,
  findLostPetsTool,
} from "../tools/tools";
import { MESSAGES } from "../config/constants";

dotenv.config();

const memory = new MemorySaver();

const llm = new ChatOpenAI({
  temperature: 0.4,
  model: "gpt-4.1",
  apiKey: process.env.OPENAI_API_KEY,
  maxTokens: 360,
});

const tools = [
  createPetTool,
  updatePetTool,
  updateProfileTool,
  getOwnerPetsOptimizedTool,
  createLostPetAlertTool,
  findLostPetsTool, // Nueva herramienta avanzada
  createFoundPetSightingTool, // Herramienta UNIFICADA para avistamientos y matches
];

const createModifyMessages =
  (phoneNumber: string) => (messages: BaseMessage[]) => {
    return [
      new SystemMessage(MESSAGES.SYSTEM_PROMPT),
      new HumanMessage(
        `Este es el número de teléfono del usuario: ${phoneNumber}`
      ),
      ...messages,
    ];
  };

// Función para crear agente con número específico
export const createAgentWithPhone = (phoneNumber: string) => {
  return createReactAgent({
    llm,
    tools,
    messageModifier: createModifyMessages(phoneNumber),
    checkpointSaver: memory,
  });
};

// Mantener compatibilidad hacia atrás (deprecado)
export const appWithMemory = createReactAgent({
  llm,
  tools,
  messageModifier: (messages: BaseMessage[]) => [
    new SystemMessage(MESSAGES.SYSTEM_PROMPT),
    ...messages,
  ],
  checkpointSaver: memory,
});
