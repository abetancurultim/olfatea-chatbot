"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.options('*', (0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const PORT = 3021;
const allowedOrigins = ['http://localhost:5173', 'https://ultim-admin-dashboard.web.app', 'https://ultim-admin-dashboard.firebaseapp.com', 'https://dashboard.ultim.pro', 'https://ultim.pro', 'https://trasnferchat-1336.twil.io/transferChat', 'https://trasnferchat-1336.twil.io', 'https://ultim.pro/dashboard/carestream/chat-carestream'];
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.options('*', (0, cors_1.default)());
app.use('/', chatRoutes_1.default);
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
