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
                    text: data.text,
                    gameName: data.gameName || "Unknown Game"
                };
                
                if (!roomHistory[targetRoom]) {
                    roomHistory[targetRoom] = [];
                }
                roomHistory[targetRoom].push(msgData);
                if (roomHistory[targetRoom].length > 50) {
                    roomHistory[targetRoom].shift();
                }
                
                broadcast(targetRoom, msgData.user, msgData.text, msgData.gameName);

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

function broadcast(room, user, text, gameName) {
    clients.forEach(client => {
        if (client.room === room && client.readyState === 1) {
            client.send(JSON.stringify({ 
                user: user, 
                text: text, 
                gameName: gameName 
            }));
        }
    });
}

server.listen(process.env.PORT || 3000);

Теперь клиентский скрипт (Lua). Я добавил получение названия игры и его отображение под ником.

local socketUrl = "wss://rglobal-chat.onrender.com"

local Players = game:GetService("Players")
local Http = game:GetService("HttpService")
local CoreGui = game:GetService("CoreGui")
local RunService = game:GetService("RunService")
local MarketplaceService = game:GetService("MarketplaceService")

local LocalPlayer = Players.LocalPlayer
local CurrentRoom = "global"
local FriendsFile = "GlobalChatFriends.json"
local SavedFriends = {}
local PreviousPage = nil 
local UnreadMessages = {} 

local CurrentGameName = "Unknown Game"
pcall(function()
    local productInfo = MarketplaceService:GetProductInfo(game.PlaceId)
    CurrentGameName = productInfo.Name
end)

if isfile and isfile(FriendsFile) then
    pcall(function()
        SavedFriends = Http:JSONDecode(readfile(FriendsFile))
    end)
end

local function SaveFriends()
    if writefile then
        writefile(FriendsFile, Http:JSONEncode(SavedFriends))
    end
end

local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = "GlobalChatApp"
ScreenGui.Parent = CoreGui

local OpenButton = Instance.new("TextButton")
OpenButton.Parent = ScreenGui
OpenButton.Size = UDim2.new(0, 100, 0, 50)
OpenButton.Position = UDim2.new(0, 10, 0.1, 0)
OpenButton.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
OpenButton.TextColor3 = Color3.fromRGB(255, 255, 255)
OpenButton.Text = "MENU"
OpenButton.Font = Enum.Font.SourceSansBold
OpenButton.TextSize = 18
local uiCornerBtn = Instance.new("UICorner")
uiCornerBtn.CornerRadius = UDim.new(0, 10)
uiCornerBtn.Parent = OpenButton

local MainFrame = Instance.new("Frame")
MainFrame.Parent = ScreenGui
MainFrame.Size = UDim2.new(0.6, 0, 0.6, 0)
MainFrame.Position = UDim2.new(0.2, 0, 0.2, 0)
MainFrame.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
MainFrame.Visible = false
MainFrame.Active = true
MainFrame.Draggable = true
local uiCornerMain = Instance.new("UICorner")
uiCornerMain.CornerRadius = UDim.new(0, 12)
uiCornerMain.Parent = MainFrame

local TitleLabel = Instance.new("TextLabel")
TitleLabel.Parent = MainFrame
TitleLabel.Size = UDim2.new(1, -80, 0, 40)
TitleLabel.Position = UDim2.new(0, 40, 0, 0)
TitleLabel.BackgroundTransparency = 1
TitleLabel.Text = "Global Chat Hub"
TitleLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
TitleLabel.Font = Enum.Font.SourceSansBold
TitleLabel.TextSize = 20
TitleLabel.TextXAlignment = Enum.TextXAlignment.Center

local CloseMain = Instance.new("TextButton")
CloseMain.Parent = MainFrame
CloseMain.Size = UDim2.new(0, 30, 0, 30)
CloseMain.Position = UDim2.new(1, -35, 0, 5)
CloseMain.BackgroundTransparency = 1
CloseMain.Text = "X"
CloseMain.TextColor3 = Color3.fromRGB(255, 50, 50)
CloseMain.TextSize = 22
CloseMain.Font = Enum.Font.SourceSansBold

local PageContainer = Instance.new("Frame")
PageContainer.Parent = MainFrame
PageContainer.Size = UDim2.new(1, 0, 1, -50)
PageContainer.Position = UDim2.new(0, 0, 0, 50)
PageContainer.BackgroundTransparency = 1

local MenuPage = Instance.new("Frame")
MenuPage.Parent = PageContainer
MenuPage.Size = UDim2.new(1, 0, 1, 0)
MenuPage.BackgroundTransparency = 1
MenuPage.Visible = true

local MenuLayout = Instance.new("UIListLayout")
MenuLayout.Parent = MenuPage
MenuLayout.SortOrder = Enum.SortOrder.LayoutOrder
MenuLayout.Padding = UDim.new(0, 8)
MenuLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
MenuLayout.VerticalAlignment = Enum.VerticalAlignment.Center

local MenuButtons = {}

local function CreateMenuButton(text, order, callback)
    local btn = Instance.new("TextButton")
    btn.Parent = MenuPage
    btn.Size = UDim2.new(0.7, 0, 0, 35)
    btn.BackgroundColor3 = Color3.fromRGB(45, 45, 45)
    btn.TextColor3 = Color3.fromRGB(255, 255, 255)
    btn.Text = text
    btn.Font = Enum.Font.SourceSans
    btn.TextSize = 16
    btn.LayoutOrder = order
    local uic = Instance.new("UICorner")
    uic.CornerRadius = UDim.new(0, 8)
    uic.Parent = btn
    btn.MouseButton1Click:Connect(callback)
    MenuButtons[text] = btn
    return btn
end

local ChatPage = Instance.new("Frame")
ChatPage.Parent = PageContainer
ChatPage.Size = UDim2.new(1, 0, 1, 0)
ChatPage.BackgroundTransparency = 1
ChatPage.Visible = false

local ChatScroll = Instance.new("ScrollingFrame")
ChatScroll.Parent = ChatPage
ChatScroll.Size = UDim2.new(1, -20, 1, -50)
ChatScroll.Position = UDim2.new(0, 10, 0, 0)
ChatScroll.BackgroundTransparency = 1
ChatScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
ChatScroll.CanvasSize = UDim2.new(0,0,0,0)
ChatScroll.ScrollBarThickness = 4

local ChatLayout = Instance.new("UIListLayout")
ChatLayout.Parent = ChatScroll
ChatLayout.SortOrder = Enum.SortOrder.LayoutOrder
ChatLayout.Padding = UDim.new(0, 5)

local ChatInput = Instance.new("TextBox")
ChatInput.Parent = ChatPage
ChatInput.Size = UDim2.new(0.75, 0, 0, 35)
ChatInput.Position = UDim2.new(0, 10, 1, -40)
ChatInput.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
ChatInput.TextColor3 = Color3.fromRGB(255, 255, 255)
ChatInput.Text = ""
ChatInput.PlaceholderText = "Message..."
ChatInput.ClearTextOnFocus = false
ChatInput.TextXAlignment = Enum.TextXAlignment.Left
local inputPad = Instance.new("UIPadding")
inputPad.Parent = ChatInput
inputPad.PaddingLeft = UDim.new(0, 8)
local uicInput = Instance.new("UICorner")
uicInput.CornerRadius = UDim.new(0, 8)
uicInput.Parent = ChatInput

local SendBtn = Instance.new("TextButton")
SendBtn.Parent = ChatPage
SendBtn.Size = UDim2.new(0.2, -15, 0, 35)
SendBtn.Position = UDim2.new(0.8, 5, 1, -40)
SendBtn.BackgroundColor3 = Color3.fromRGB(0, 120, 215)
SendBtn.Text = "➤"
SendBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
SendBtn.TextSize = 20
local uicSend = Instance.new("UICorner")
uicSend.CornerRadius = UDim.new(0, 8)
uicSend.Parent = SendBtn

local BackBtn = Instance.new("TextButton")
BackBtn.Parent = MainFrame
BackBtn.Size = UDim2.new(0, 60, 0, 30)
BackBtn.Position = UDim2.new(0, 5, 0, 5) 
BackBtn.BackgroundColor3 = Color3.fromRGB(60, 20, 20)
BackBtn.Text = "< Back"
BackBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
BackBtn.Visible = false 
local uicBack = Instance.new("UICorner")
uicBack.CornerRadius = UDim.new(0, 6)
uicBack.Parent = BackBtn

local FriendsPage = Instance.new("Frame")
FriendsPage.Parent = PageContainer
FriendsPage.Size = UDim2.new(1, 0, 1, 0)
FriendsPage.BackgroundTransparency = 1
FriendsPage.Visible = false

local FriendInput = Instance.new("TextBox")
FriendInput.Parent = FriendsPage
FriendInput.Size = UDim2.new(0.7, 0, 0, 35)
FriendInput.Position = UDim2.new(0, 10, 0, 0)
FriendInput.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
FriendInput.TextColor3 = Color3.fromRGB(255, 255, 255)
FriendInput.PlaceholderText = "Username to add..."
FriendInput.Text = ""
local uicFInput = Instance.new("UICorner")
uicFInput.CornerRadius = UDim.new(0, 8)
uicFInput.Parent = FriendInput

local AddFriendBtn = Instance.new("TextButton")
AddFriendBtn.Parent = FriendsPage
AddFriendBtn.Size = UDim2.new(0.25, -5, 0, 35)
AddFriendBtn.Position = UDim2.new(0.75, 0, 0, 0)
AddFriendBtn.BackgroundColor3 = Color3.fromRGB(0, 150, 80)
AddFriendBtn.Text = "Add"
AddFriendBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
local uicAdd = Instance.new("UICorner")
uicAdd.CornerRadius = UDim.new(0, 8)
uicAdd.Parent = AddFriendBtn

local FriendsScroll = Instance.new("ScrollingFrame")
FriendsScroll.Parent = FriendsPage
FriendsScroll.Size = UDim2.new(1, -20, 1, -50)
FriendsScroll.Position = UDim2.new(0, 10, 0, 45)
FriendsScroll.BackgroundTransparency = 1
FriendsScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
FriendsScroll.CanvasSize = UDim2.new(0,0,0,0)

local FriendsLayout = Instance.new("UIListLayout")
FriendsLayout.Parent = FriendsScroll
FriendsLayout.SortOrder = Enum.SortOrder.LayoutOrder
FriendsLayout.Padding = UDim.new(0, 5)

local PolicyPage = Instance.new("Frame")
PolicyPage.Parent = PageContainer
PolicyPage.Size = UDim2.new(1, 0, 1, 0)
PolicyPage.BackgroundTransparency = 1
PolicyPage.Visible = false

local PolicyScroll = Instance.new("ScrollingFrame")
PolicyScroll.Parent = PolicyPage
PolicyScroll.Size = UDim2.new(1, -20, 1, -10)
PolicyScroll.Position = UDim2.new(0, 10, 0, 0)
PolicyScroll.BackgroundTransparency = 1
PolicyScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
PolicyScroll.CanvasSize = UDim2.new(0,0,0,0) 

local PolicyText = Instance.new("TextLabel")
PolicyText.Parent = PolicyScroll
PolicyText.Size = UDim2.new(1, 0, 0, 0)
PolicyText.AutomaticSize = Enum.AutomaticSize.Y
PolicyText.BackgroundTransparency = 1
PolicyText.TextColor3 = Color3.fromRGB(200, 200, 200)
PolicyText.TextXAlignment = Enum.TextXAlignment.Left
PolicyText.TextYAlignment = Enum.TextYAlignment.Top
PolicyText.TextWrapped = true
PolicyText.Font = Enum.Font.SourceSans
PolicyText.TextSize = 14
PolicyText.Text = [[
TERMS OF SERVICE AND PRIVACY POLICY
Last Updated: January 2026

1. GENERAL PROVISIONS
By executing, injecting, or otherwise using the Global Chat Utility software, you explicitly agree to be bound by these Terms of Service. If you do not agree to these terms, you must immediately cease the use of the Service.

2. DATA SECURITY AND ENCRYPTION
The Service utilizes Secure WebSocket (WSS) protocols for all data transmission. This ensures that traffic between the Client and the Server is encrypted using TLS/SSL standards, protecting your data from interception by third parties during transmission.

3. PRIVACY AND IP ADDRESS COLLECTION
3.1. Technical Logging. You acknowledge that the hosting provider of the Server may automatically log technical connection data, which includes your Internet Protocol (IP) address. This is a fundamental requirement for the TCP/IP connection to function.
3.2. Data Handling by Administrator. The Developer/Administrator of the Service has access to server logs for maintenance purposes.
3.3. Liability for Disclosure. The Administrator strictly prohibits the unauthorized public disclosure of any users IP address. In the event of a proven malicious disclosure of your IP address by the Administrator, you reserve the right to report such misconduct to the relevant hosting authorities or platform moderators.
3.4. Anonymity Recommendation. To ensure complete anonymity and mask your digital footprint, the Administrator strongly recommends the use of a Virtual Private Network (VPN) while using the Service.

4. PRIVATE COMMUNICATIONS
4.1. Direct Messages. The Service is designed to facilitate private communication. The Administrator does not actively monitor, read, or permanently store the contents of private Direct Messages (DMs) exchanged between users.
4.2. User Responsibility. Users are strictly advised against sharing Personally Identifiable Information (PII), such as real names, physical addresses, or social media credentials, within the public or private chat channels.

5. LIMITATION OF LIABILITY
5.1. Platform Actions. The Service acts as an independent overlay and does not directly modify game code in a malicious manner. However, the Developer expressly disclaims all liability for any administrative actions taken against your gaming account (including, but not limited to, temporary suspensions, permanent bans, or hardware ID bans) by the platform owner (Roblox Corporation).
5.2. Usage Risk. You acknowledge that the use of third-party execution software involves inherent risks. You assume full responsibility for any consequences resulting from the use of this Service.

6. PROHIBITED CONDUCT AND LOGGING CONSENT
6.1. Logging Consent. By using this chat, you automatically consent to the logging of your public messages in the Global Chat.
6.2. Aggression Policy. Any form of aggression, harassment, or bullying towards other users may result in an immediate ban from the Service.
6.3. Political Discussions. Discussions of political topics are strictly prohibited and may result in a ban.
6.4. NSFW Content. Discussing or sharing sexualized (NSFW) content in the public chat is strictly prohibited and will result in an immediate ban.
6.5. Serious Threats. Making threats of terrorism, murder, self-harm, or suicide is strictly prohibited and will result in an immediate and permanent ban.
]]

local socket
pcall(function()
    socket = (syn and syn.websocket or WebSocket).connect(socketUrl)
end)

if not socket then
    TitleLabel.Text = "Global Chat (OFFLINE)"
end

local function UpdateButtons()
    local totalUnread = 0
    for _, count in pairs(UnreadMessages) do
        totalUnread = totalUnread + count
    end
    
    if MenuButtons["Friends"] then
        if totalUnread > 0 then
            MenuButtons["Friends"].Text = "Friends (" .. totalUnread .. ")"
        else
            MenuButtons["Friends"].Text = "Friends"
        end
    end
    
    if FriendsPage.Visible then
        for _, frame in pairs(FriendsScroll:GetChildren()) do
            if frame:IsA("Frame") then
                local btn = frame:FindFirstChild("FriendBtn")
                if btn then
                    local name = btn.Name 
                    local count = UnreadMessages[name] or 0
                    if count > 0 then
                        btn.Text = "  " .. name .. " (" .. count .. ")"
                    else
                        btn.Text = "  " .. name
                    end
                end
            end
        end
    end
end

local function ClearChat()
    for _, v in pairs(ChatScroll:GetChildren()) do
        if v:IsA("Frame") then v:Destroy() end
    end
end

local function JoinRoom(roomName)
    CurrentRoom = roomName
    ClearChat()
    
    MenuPage.Visible = false
    FriendsPage.Visible = false
    PolicyPage.Visible = false
    ChatPage.Visible = true
    
    BackBtn.Visible = true 
    
    if socket then
        socket:Send(Http:JSONEncode({
            type = "join",
            username = LocalPlayer.Name,
            room = roomName
        }))
    end
    
    if roomName == "global" then
        TitleLabel.Text = "World Chat"
    else
        local otherUser = roomName:gsub(LocalPlayer.Name, ""):gsub("_", "")
        TitleLabel.Text = "DM: " .. otherUser
        UnreadMessages[otherUser] = 0
        UpdateButtons()
    end
end

local function AddMessage(user, text, gameName)
    local msgFrame = Instance.new("Frame")
    msgFrame.Parent = ChatScroll
    msgFrame.BackgroundTransparency = 1
    msgFrame.Size = UDim2.new(1, 0, 0, 0)
    msgFrame.AutomaticSize = Enum.AutomaticSize.Y

    local nameLabel = Instance.new("TextLabel")
    nameLabel.Parent = msgFrame
    nameLabel.Size = UDim2.new(0, 100, 0, 18)
    nameLabel.BackgroundTransparency = 1
    nameLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
    nameLabel.TextXAlignment = Enum.TextXAlignment.Left
    nameLabel.TextYAlignment = Enum.TextYAlignment.Top
    nameLabel.Text = user .. ":"
    nameLabel.Font = Enum.Font.SourceSansBold
    nameLabel.TextSize = 18
    
    local gameLabel = Instance.new("TextLabel")
    gameLabel.Parent = msgFrame
    gameLabel.Size = UDim2.new(0, 100, 0, 12)
    gameLabel.Position = UDim2.new(0, 0, 0, 18)
    gameLabel.BackgroundTransparency = 1
    gameLabel.TextColor3 = Color3.fromRGB(180, 180, 180)
    gameLabel.TextXAlignment = Enum.TextXAlignment.Left
    gameLabel.TextYAlignment = Enum.TextYAlignment.Top
    gameLabel.Text = gameName or "Unknown"
    gameLabel.Font = Enum.Font.SourceSansItalic
    gameLabel.TextSize = 12

    local textLabel = Instance.new("TextLabel")
    textLabel.Parent = msgFrame
    textLabel.Size = UDim2.new(1, -105, 0, 0)
    textLabel.Position = UDim2.new(0, 105, 0, 0)
    textLabel.BackgroundTransparency = 1
    textLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
    textLabel.TextXAlignment = Enum.TextXAlignment.Left
    textLabel.TextYAlignment = Enum.TextYAlignment.Top
    textLabel.TextWrapped = true
    textLabel.AutomaticSize = Enum.AutomaticSize.Y
    textLabel.Text = text
    textLabel.Font = Enum.Font.SourceSans
    textLabel.TextSize = 18

    ChatScroll.CanvasPosition = Vector2.new(0, 999999)
end

if socket then
    socket.OnMessage:Connect(function(msg)
        local success, data = pcall(function() return Http:JSONDecode(msg) end)
        if success then
            if data.type == "notification" then
                if data.from then
                    local p1 = LocalPlayer.Name
                    local p2 = data.from
                    local dmRoom = (p1 < p2) and (p1.."_"..p2) or (p2.."_"..p1)
                    
                    if CurrentRoom ~= dmRoom then
                        UnreadMessages[data.from] = (UnreadMessages[data.from] or 0) + 1
                        UpdateButtons()
                    end
                end
            elseif data.user and data.text then
                AddMessage(data.user, data.text, data.gameName)
            end
        end
    end)
end

local function UpdateFriendList()
    for _, v in pairs(FriendsScroll:GetChildren()) do
        if v:IsA("Frame") then v:Destroy() end
    end
    
    for i, friendName in pairs(SavedFriends) do
        local container = Instance.new("Frame")
        container.Parent = FriendsScroll
        container.Size = UDim2.new(1, 0, 0, 40)
        container.BackgroundTransparency = 1
        
        local btn = Instance.new("TextButton")
        btn.Parent = container
        btn.Name = "FriendBtn" 
        btn.Name = friendName 
        btn.Size = UDim2.new(0.8, -5, 1, 0)
        btn.BackgroundColor3 = Color3.fromRGB(35, 35, 35)
        
        local count = UnreadMessages[friendName] or 0
        if count > 0 then
            btn.Text = "  " .. friendName .. " (" .. count .. ")"
        else
            btn.Text = "  " .. friendName
        end
        
        btn.TextColor3 = Color3.fromRGB(255, 255, 255)
        btn.TextXAlignment = Enum.TextXAlignment.Left
        btn.Font = Enum.Font.SourceSans
        btn.TextSize = 18
        local uic = Instance.new("UICorner")
        uic.CornerRadius = UDim.new(0, 6)
        uic.Parent = btn
        
        btn.MouseButton1Click:Connect(function()
            PreviousPage = FriendsPage 
            local p1 = LocalPlayer.Name
            local p2 = friendName
            local dmRoom = (p1 < p2) and (p1.."_"..p2) or (p2.."_"..p1)
            JoinRoom(dmRoom)
        end)
        
        local delBtn = Instance.new("TextButton")
        delBtn.Parent = container
        delBtn.Size = UDim2.new(0.2, -5, 1, 0)
        delBtn.Position = UDim2.new(0.8, 5, 0, 0)
        delBtn.BackgroundColor3 = Color3.fromRGB(150, 0, 0)
        delBtn.Text = "🗑"
        delBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
        delBtn.TextSize = 18
        local uicDel = Instance.new("UICorner")
        uicDel.CornerRadius = UDim.new(0, 6)
        uicDel.Parent = delBtn
        
        delBtn.MouseButton1Click:Connect(function()
            table.remove(SavedFriends, i)
            SaveFriends()
            UpdateFriendList()
        end)
    end
end

CreateMenuButton("World Chat", 1, function()
    PreviousPage = MenuPage
    JoinRoom("global")
end)

CreateMenuButton("Friends", 2, function()
    MenuPage.Visible = false
    FriendsPage.Visible = true
    BackBtn.Visible = true
    PreviousPage = MenuPage 
    UpdateFriendList()
    TitleLabel.Text = "Friends"
end)

CreateMenuButton("Privacy Policy", 3, function()
    MenuPage.Visible = false
    PolicyPage.Visible = true
    BackBtn.Visible = true
    PreviousPage = MenuPage
    TitleLabel.Text = "Privacy Policy"
end)

AddFriendBtn.MouseButton1Click:Connect(function()
    local name = FriendInput.Text
    if name ~= "" and not table.find(SavedFriends, name) then
        local success, userId = pcall(function()
            return Players:GetUserIdFromNameAsync(name)
        end)
        
        if success then
            table.insert(SavedFriends, name)
            SaveFriends()
            UpdateFriendList()
            FriendInput.Text = ""
        else
            local oldColor = FriendInput.BackgroundColor3
            FriendInput.BackgroundColor3 = Color3.fromRGB(150, 0, 0)
            FriendInput.Text = "User not found!"
            task.delay(1, function()
                FriendInput.Text = ""
                FriendInput.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
            end)
        end
    end
end)

local function GoBack()
    ChatPage.Visible = false
    FriendsPage.Visible = false
    PolicyPage.Visible = false
    
    if PreviousPage == FriendsPage then
        FriendsPage.Visible = true
        TitleLabel.Text = "Friends"
        PreviousPage = MenuPage 
        UpdateFriendList() 
    else
        MenuPage.Visible = true
        TitleLabel.Text = "Global Chat Hub"
        BackBtn.Visible = false 
    end
end

BackBtn.MouseButton1Click:Connect(GoBack)

local function SendMessage()
    if ChatInput.Text ~= "" and socket then
        socket:Send(Http:JSONEncode({
            type = "chat",
            username = LocalPlayer.Name,
            text = ChatInput.Text,
            room = CurrentRoom,
            gameName = CurrentGameName
        }))
        ChatInput.Text = ""
        ChatScroll.CanvasPosition = Vector2.new(0, 999999)
    end
end

SendBtn.MouseButton1Click:Connect(SendMessage)
ChatInput.FocusLost:Connect(function(enter)
    if enter then SendMessage() end
end)

OpenButton.MouseButton1Click:Connect(function()
    MainFrame.Visible = not MainFrame.Visible
    OpenButton.Text = MainFrame.Visible and "CLOSE" or "MENU"
end)

CloseMain.MouseButton1Click:Connect(function()
    MainFrame.Visible = false
    OpenButton.Text = "MENU"
end) 
