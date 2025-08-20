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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportedFromNumber = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const uuid_1 = require("uuid");
const mainAgent_1 = require("../agents/mainAgent");
const messages_1 = require("@langchain/core/messages");
const twilio_1 = __importDefault(require("twilio"));
const saveChatHistory_1 = require("../utils/saveChatHistory");
const app_1 = require("firebase/app");
const openai_1 = require("openai");
const node_fetch_1 = __importDefault(require("node-fetch"));
const storage_1 = require("firebase/storage");
const elevenlabs_1 = require("elevenlabs");
const getAvailableForAudio_1 = require("../utils/getAvailableForAudio");
const getAvailableChatOn_1 = require("../utils/getAvailableChatOn");
dotenv_1.default.config();
const router = express_1.default.Router();
const MessagingResponse = twilio_1.default.twiml.MessagingResponse; // mandar un texto simple
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = (0, twilio_1.default)(accountSid, authToken); // mandar un texto con media
const openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// ElevenLabs Client
const elevenlabsClient = new elevenlabs_1.ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
});
const createAudioStreamFromText = (text) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    const audioStream = yield elevenlabsClient.generate({
        voice: "Andrea",
        model_id: "eleven_flash_v2_5",
        text,
    });
    const chunks = [];
    try {
        for (var _d = true, audioStream_1 = __asyncValues(audioStream), audioStream_1_1; audioStream_1_1 = yield audioStream_1.next(), _a = audioStream_1_1.done, !_a; _d = true) {
            _c = audioStream_1_1.value;
            _d = false;
            const chunk = _c;
            chunks.push(chunk);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = audioStream_1.return)) yield _b.call(audioStream_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    const content = Buffer.concat(chunks);
    return content;
});
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
};
const app = (0, app_1.initializeApp)(firebaseConfig);
const storage = (0, storage_1.getStorage)();
let exportedFromNumber;
// Ruta para enviar mensajes de WhatsApp
router.post("/russell-chat/send-message", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { to, body } = req.body;
    console.log(req.body);
    try {
        const message = yield client.messages.create({
            from: "whatsapp:+5745012081",
            to: `whatsapp:${to}`,
            body: body,
        });
        res
            .status(200)
            .json({ success: true, message: "Mensaje enviado", sid: message.sid });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al enviar el mensaje",
            error: error instanceof Error ? error.message : "An unknown error occurred",
        });
    }
}));
// chat endpoint para recibir mensajes con twilio
router.post("/russell-chat/receive-message", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const twiml = new MessagingResponse();
    // console.log('Mensaje recibido:', req.body);
    const from = req.body.From;
    const to = req.body.To;
    console.log("from:", from, "to:", to);
    // Parseo de numeros de telefono
    const fromColonIndex = from.indexOf(":");
    const toColonIndex = to.indexOf(":");
    // Numero de telefono que pasa de "whatsapp:+57XXXXXXXXX" a "+57XXXXXXXXX"
    const fromNumber = from.slice(fromColonIndex + 1);
    const toNumber = to.slice(toColonIndex + 1);
    exports.exportedFromNumber = exportedFromNumber = fromNumber;
    // console.log("Raw request body:", JSON.stringify(req.body, null, 2));
    try {
        let incomingMessage;
        // console.log('Incoming message Type:', req.body.Body);
        if (req.body.MediaContentType0 &&
            req.body.MediaContentType0.includes("audio")) {
            try {
                const mediaUrl = yield req.body.MediaUrl0;
                const response = yield (0, node_fetch_1.default)(mediaUrl, {
                    headers: {
                        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
                    },
                });
                const file = yield (0, openai_1.toFile)(response.body, "recording.wav");
                const transcription = yield openai.audio.transcriptions.create({
                    file,
                    model: "whisper-1",
                    prompt: "Por favor, transcribe el audio y asegúrate de escribir los números exactamente como se pronuncian, sin espacios, comas, ni puntos. Por ejemplo, un número de documento   debe ser transcrito como 1143939192.",
                });
                const { text } = transcription;
                incomingMessage = text;
            }
            catch (error) {
                console.error("Error transcribing audio:", error);
                twiml.message("En este momento no puedo transcribir audios, por favor intenta con un mensaje de texto. O prueba grabando el audio nuevamente.");
                res.writeHead(200, { "Content-Type": "text/xml" });
                res.end(twiml.toString());
            }
        }
        else {
            incomingMessage = req.body.Body;
        }
        yield (0, saveChatHistory_1.saveChatHistory)(fromNumber, incomingMessage, true);
        // Validar si en el dashboard se encuentra activado el chat
        const chatOn = yield (0, getAvailableChatOn_1.getAvailableChatOn)(fromNumber);
        if (!chatOn) {
            const config = {
                configurable: {
                    thread_id: fromNumber,
                },
            };
            console.log("Incoming message:", incomingMessage);
            const agentOutput = yield mainAgent_1.appWithMemory.invoke({
                messages: [new messages_1.HumanMessage(incomingMessage)],
            }, config);
            // console.log("Respuesta completa de OpenAI:", JSON.stringify(agentOutput, null, 2));
            const lastMessage = agentOutput.messages[agentOutput.messages.length - 1];
            if (!lastMessage || typeof lastMessage.content !== "string") {
                console.error("Error: El mensaje de la IA es nulo o no es un string.");
                return res
                    .status(500)
                    .send({ error: "La IA no generó una respuesta válida." });
            }
            const responseMessage = lastMessage.content;
            console.log("Respuesta IA:", responseMessage);
            yield (0, saveChatHistory_1.saveChatHistory)(fromNumber, responseMessage, false);
            const isAvailableForAudio = yield (0, getAvailableForAudio_1.getAvailableForAudio)(fromNumber);
            // Si la respuesta es menor a 600 caracteres && no contiene números, hacer TTS y enviar el audio
            if (responseMessage.length <= 600 && // Menor a 600 caracteres
                !/\d/.test(responseMessage) && // No contiene números
                !/\b(?:[A-Z]{2,}|\b(?:[A-Z]\.){2,}[A-Z]?)\b/.test(responseMessage) && // No contiene siglas
                isAvailableForAudio // El cliente puede recibir audios
            ) {
                console.log("Entró a enviar audio");
                try {
                    const audioBuffer = yield createAudioStreamFromText(responseMessage);
                    const audioName = `${(0, uuid_1.v4)()}.wav`;
                    // Subir el archivo de audio a Firebase Storage
                    const storageRef = (0, storage_1.ref)(storage, `audios/${audioName}`);
                    const metadata = {
                        contentType: "audio/mpeg",
                    };
                    const uploadTask = (0, storage_1.uploadBytesResumable)(storageRef, audioBuffer, metadata);
                    // Esperar a que la subida complete y obtener la URL pública
                    uploadTask.on("state_changed", (snapshot) => {
                        // Progreso de la subida (opcional)
                        console.log("Upload is in progress...");
                    }, (error) => {
                        throw new Error(`Upload failed: ${error.message}`);
                    }, () => __awaiter(void 0, void 0, void 0, function* () {
                        // Subida completada
                        const audioUrl = yield (0, storage_1.getDownloadURL)(uploadTask.snapshot.ref);
                        // Envía el archivo de audio a través de Twilio
                        yield client.messages.create({
                            body: "Audio message",
                            from: to,
                            to: from,
                            mediaUrl: [audioUrl],
                        });
                        console.log("Audio message sent successfully");
                        res.writeHead(200, { "Content-Type": "text/xml" });
                        res.end(twiml.toString());
                    }));
                }
                catch (error) {
                    console.error("Error sending audio message:", error);
                    twiml.message(responseMessage);
                    res.writeHead(200, { "Content-Type": "text/xml" });
                    res.end(twiml.toString());
                }
            }
            else {
                // Responder con el texto si es mayor de 400 caracteres
                try {
                    const message = yield client.messages.create({
                        body: responseMessage,
                        from: "whatsapp:+5745012081",
                        // from: 'whatsapp:+14155238886', // Sandbox Twilio
                        to: from,
                    });
                }
                catch (error) {
                    console.error("Error sending message:", error);
                }
            }
        }
    }
    catch (error) {
        console.error("Error in chat route:", error);
        res.status(500).send({
            error: error instanceof Error ? error.message : "An unknown error occurred",
        });
    }
}));
// Ruta principal
router.get("/russell-chat/chat-test", (req, res) => {
    res.send("Chat de Russell Bedford funcionando correctamente con Typescript y Express.");
});
exports.default = router;
