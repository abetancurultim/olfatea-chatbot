"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appWithMemory = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const openai_1 = require("@langchain/openai");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const messages_1 = require("@langchain/core/messages");
const langgraph_1 = require("@langchain/langgraph");
const tools_1 = require("../tools/tools");
const constants_1 = require("../config/constants");
dotenv_1.default.config();
const memory = new langgraph_1.MemorySaver();
const llm = new openai_1.ChatOpenAI({
    temperature: 0,
    model: "gpt-4o",
    apiKey: process.env.OPENAI_API_KEY,
    maxTokens: 260,
});
const tools = [
    tools_1.retrieverTool,
    tools_1.saveClientDataTool,
    tools_1.contactTool,
    tools_1.setAvailableForAudioTool,
    tools_1.validateCityTool,
    tools_1.updateNotificationsTool,
    tools_1.jobOpportunitiesTool,
];
const modifyMessages = (messages) => {
    return [
        new messages_1.SystemMessage(constants_1.MESSAGES.SYSTEM_PROMPT),
        ...messages,
    ];
};
exports.appWithMemory = (0, prebuilt_1.createReactAgent)({
    llm,
    tools,
    messageModifier: modifyMessages,
    checkpointSaver: memory,
});
