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

const commandList = [
  "무궁화",
  "무궁화 꽃이",
  "무궁화 꽃이 피었",
  "무궁화 꽃이 피었습니",
  "무궁화 꽃이 피었습니다!",
];

function delayPrint(callback: () => void, minDelay: number, maxDelay: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      callback();
      resolve(undefined);
    }, Math.random() * (maxDelay - minDelay) + minDelay * 1000);
  });
}

type SharonRoom = {
  users: SharonUser[];
  started: boolean;
  command: string;
  timeout: NodeJS.Timeout | null;
};

type SharonUser = {
  step: number;
  id: string;
  uid: string;
  name: string;
  isDie?: boolean;
};

let sharonMap: {
  [key: string]: SharonRoom;
} = {};

type TimerRoom = {
  started: boolean;
  users: TimerUser[];
  targetTime: number;
  ended: boolean;
};

type TimerUser = {
  id: string;
  uid: string;
  time?: number;
};

let timerMap: {
  [key: string]: TimerRoom;
} = {};

io.on("connection", function (socket) {
  socket.on("sharon_in", (roomName, uid, name) => {
    if (!sharonMap[roomName]) {
      sharonMap[roomName] = {
        started: false,
        users: [],
        command: "무궁화",
        timeout: null,
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
      name,
    };

    users.push(user);

    socket.join(roomName);

    io.to(roomName).emit("sharon_member", users);

    if (users.length === 5) {
      sharonMap[roomName].started = true;
      io.to(roomName).emit("sharon_start");
      io.to(roomName).emit("sharon_command", "무궁화...");

      let index = 1;

      const commandList = [
        "무궁화...",
        "무궁화 꽃이...",
        "무궁화 꽃이 피었...",
        "무궁화 꽃이 피었습니...",
        "무궁화 꽃이 피었습니다!",
      ];

      (function loop() {
        var rand = Math.round(Math.random() * (3000 - 500)) + 500;
        sharonMap[roomName].timeout = setTimeout(function () {
          const command = commandList[index % commandList.length];

          sharonMap[roomName].command = command;

          index += 1;

          io.to(roomName).emit("sharon_command", command);
          loop();
        }, rand);
      })();
    }
  });

  socket.on("sharon_step", (roomName) => {
    const users = sharonMap[roomName].users;
    const user = users.find((user) => user.id === socket.id);

    if (user) {
      if (sharonMap[roomName].command === "무궁화 꽃이 피었습니다!") {
        io.to(roomName).emit("sharon_die", user.uid);
        user.isDie = true;

        const aliveUsers = users.filter((user) => !user.isDie);

        if (aliveUsers.length === 1) {
          clearTimeout(sharonMap[roomName].timeout!);
          sharonMap[roomName].timeout = null;

          io.to(roomName).emit("sharon_ended", aliveUsers[0].uid);
        }
      }
      user.step += 1;

      if (user.step === 100) {
        clearTimeout(sharonMap[roomName].timeout!);
        sharonMap[roomName].timeout = null;

        io.to(roomName).emit("sharon_ended", user.uid);
      }
    }

    io.to(roomName).emit("sharon_member", users);
  });

  socket.on("timer_in", (roomName, uid) => {
    if (!timerMap[roomName]) {
      // 5~10 초 사이의 랜덤한 시간을 타겟으로 설정
      const targetTime = Math.floor(Math.random() * (10 - 5 + 1)) + 5;

      timerMap[roomName] = {
        started: false,
        users: [],
        ended: false,
        targetTime,
      };
    }

    // 이미 시작된 방이면 더이상 입장 불가
    if (timerMap[roomName].started) {
      return;
    }

    const users = timerMap[roomName].users;

    const user: TimerUser = {
      id: socket.id,
      uid,
    };

    users.push(user);

    socket.join(roomName);

    io.to(roomName).emit("timer_users", users);

    if (users.length === 5) {
      timerMap[roomName].started = true;
      io.to(roomName).emit("timer_start", timerMap[roomName].targetTime);
    }
  });

  socket.on(
    "time_check",
    (roomName: string, time: number, done: () => void) => {
      const users = timerMap[roomName].users;
      const user = users.find((user) => user.id === socket.id);

      if (user) {
        user.time = time;
      }
      done();

      // targetTime 에 가장 가까운 유저가 있으면 게임 종료
      const ended = users.every((user) => user.time !== undefined);

      if (ended) {
        timerMap[roomName].ended = true;
        io.to(roomName).emit(
          "timer_ended",
          users,
          timerMap[roomName].targetTime
        );
      }
    }
  );

  socket.on("disconnecting", () => {
    const sharonRoomKeys = Object.keys(sharonMap);

    sharonRoomKeys.forEach((key) => {
      const users = sharonMap[key];
      const userIndex = users.users.findIndex((user) => user.id === socket.id);

      if (userIndex !== -1) {
        users.users.splice(userIndex, 1);
        io.to(key).emit("sharon_member", users.users);
      }
    });

    const timerRoomKeys = Object.keys(timerMap);

    timerRoomKeys.forEach((key) => {
      const users = timerMap[key];
      const userIndex = users.users.findIndex((user) => user.id === socket.id);

      if (userIndex !== -1) {
        users.users.splice(userIndex, 1);
      }
    });
  });
});
