const { Server } = require("ws");
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

let clients = [];
let roomHistory = {}; 

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
                ws.room = data.room;

                if (roomHistory[ws.room] && roomHistory[ws.room].length > 0) {
                    roomHistory[ws.room].forEach(msg => {
                        ws.send(JSON.stringify(msg));
                    });
                }
                
                if (ws.room !== "global") {
                   broadcast(ws.room, "System", ws.username + " connected.");
                }
            } 
            else if (data.type === "chat") {
                const targetRoom = data.room || ws.room;
                
                const msgData = { 
                    user: data.username || ws.username, 
                    text: data.text 
                };
                
                if (!roomHistory[targetRoom]) {
                    roomHistory[targetRoom] = [];
                }
                roomHistory[targetRoom].push(msgData);
                if (roomHistory[targetRoom].length > 50) {
                    roomHistory[targetRoom].shift();
                }
                
                broadcast(targetRoom, msgData.user, msgData.text);

                if (targetRoom.includes("_")) {
                    const parts = targetRoom.split("_");
                    const sender = msgData.user;
                    const recipient = parts[0] === sender ? parts[1] : parts[0];
                    
                    const targetSocket = clients.find(c => c.username === recipient);
                    if (targetSocket) {
                        targetSocket.send(JSON.stringify({
                            type: "notification",
                            from: sender,
                            room: targetRoom
                        }));
                    }
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
