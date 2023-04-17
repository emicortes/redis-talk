// Importing required modules
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const redis = require("redis");

const setupRedis = async () => {
  // Creating a Redis client and subscribing to the chat topic
  const redisClient = redis.createClient(process.env.REDIS_URL || "localhost");

  await redisClient.connect();

  return redisClient;
};

const TTL_S = 10;
const PROCESSING_TIME_MS = 2000;

const setupApi = (app, redisClient) => {
  const getCacheKey = (req) => `cache:${req.path}`;

  const cacheMiddleware = async (req, res, next) => {
    const key = getCacheKey(req);
    if (await redisClient.exists(key)) {
      const cachedData = await redisClient.get(key);
      res.send(JSON.parse(cachedData));
    } else {
      const originalSend = res.send;
      res.send = (data) => {
        redisClient.set(key, JSON.stringify(data), { EX: TTL_S }); // Set TTL to 1 hour (3600 seconds)
        res.send = originalSend;
        res.send(data);
      };
      next();
    }
  };

  app.get("/test", cacheMiddleware, (req, res) => {
    setTimeout(
      () => res.send({ value: Math.random(), comment: "I'm an expensive result" }),
      PROCESSING_TIME_MS
    );
  });
};

const init = async () => {
  // Creating the Express app
  const app = express();

  // Creating the HTTP server and passing in the Express app
  const server = http.createServer(app);

  // Creating the Socket.io server and passing in the HTTP server
  const io = socketio(server);
  const redisClient = await setupRedis(io);

  setupApi(app, redisClient);

  // Starting the server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

init();
