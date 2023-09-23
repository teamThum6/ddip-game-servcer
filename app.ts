import express from "express";
const app = express();
const server = require("http").createServer(app);
import cors from "cors";
import { Server } from "socket.io";

app.use(cors());

const port = 8080;

server.listen(port, function () {
  console.log("Socket IO server listening on port 3000");
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

type SharonRoom = {
  users: User[];
  started: boolean;
};

type User = {
  step: number;
  id: string;
  uid: string;
};

let sharonMap: {
  [key: string]: SharonRoom;
} = {};

io.on("connection", function (socket) {
  socket.on("sharon_in", (roomName, uid) => {
    if (!sharonMap[roomName]) {
      sharonMap[roomName] = {
        started: false,
        users: [],
      };
    }

    // 이미 시작된 방이면 더이상 입장 불가
    if (sharonMap[roomName].started) {
      return;
    }

    const users = sharonMap[roomName].users;

    const user = {
      step: 0,
      id: socket.id,
      uid,
    };

    users.push(user);

    socket.join(roomName);

    io.to(roomName).emit("sharon_in", users);

    if (users.length === 2) {
      sharonMap[roomName].started = true;
      io.to(roomName).emit("sharon_start");
    }
  });

  socket.on("step", (roomName) => {
    const users = sharonMap[roomName].users;
    const user = users.find((user) => user.id === socket.id);

    if (user) {
      user.step += 1;
    }

    io.to(roomName).emit("sharon_in", users);
  });

  socket.on("disconnecting", () => {
    const sharonRoomKeys = Object.keys(sharonMap);

    sharonRoomKeys.forEach((key) => {
      const users = sharonMap[key];
      const userIndex = users.users.findIndex((user) => user.id === socket.id);

      if (userIndex !== -1) {
        users.users.splice(userIndex, 1);
        io.to(key).emit("sharon_in", users.users);
      }
    });
  });
});
