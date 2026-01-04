const { Server } = require("ws");
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const wss = new Server({ server });
let clients = [];

app.get("/", (req, res) => {
    res.send("Server Online");
});

wss.on("connection", (ws) => {
    ws.room = "global";
    ws.username = "Guest";
    clients.push(ws);

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === "join") {
                ws.username = data.username;
                broadcast(ws.room, "System", ws.username + " connected.");
            } 
            else if (data.type === "chat") {
                const text = data.text;
                
                if (text.startsWith("/join ")) {
                    const newRoom = text.split(" ")[1];
                    ws.room = newRoom;
                    ws.send(JSON.stringify({ user: "System", text: "Joined room: " + newRoom }));
                } 
                else if (text.startsWith("/w ")) {
                    const parts = text.split(" ");
                    const targetName = parts[1];
                    const pmText = parts.slice(2).join(" ");
                    const target = clients.find(c => c.username === targetName);
                    if (target) {
                        target.send(JSON.stringify({ user: "[PM] " + ws.username, text: pmText }));
                        ws.send(JSON.stringify({ user: "[PM] -> " + targetName, text: pmText }));
                    }
                } 
                else {
                    broadcast(ws.room, ws.username, text);
                }
            }
        } catch (e) {}
    });

    ws.on("close", () => {
        clients = clients.filter(c => c !== ws);
    });
});

function broadcast(room, user, text) {
    clients.forEach(client => {
        if (client.room === room && client.readyState === 1) {
            client.send(JSON.stringify({ user: user, text: text }));
        }
    });
}

server.listen(process.env.PORT || 3000); 
