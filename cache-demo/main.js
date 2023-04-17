// Importing required modules
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const redis = require("redis");

// redis client setup
const setupRedis = async () => {
  const redisClient = redis.createClient(process.env.REDIS_URL || "localhost");

  await redisClient.connect();

  return redisClient;
};

// api setup
const TTL_S = 10;
const PROCESSING_TIME_MS = 2000;
const setupApi = (app, redisClient) => {
  //cache key builder
  const getCacheKey = (req) => `cache:${req.path}`;

  // middleware
  const cacheMiddleware = async (req, res, next) => {
    //build cache key
    const key = getCacheKey(req);

    //find response in redis
    if (await redisClient.exists(key)) {
      // cache hit
      const cachedData = await redisClient.get(key);

      // set ttl header
      res.set('Redis-TTL', await redisClient.ttl(key));

      res.send(JSON.parse(cachedData));
    } else {
      // cache miss, override res.send method
      const originalSend = res.send;
      res.send = (data) => {
        // set the response cache content, using the proper Time To Live
        redisClient.set(key, JSON.stringify(data), { EX: TTL_S });

        // set ttl header
        res.set('Redis-TTL', TTL_S);

        // restore method override
        res.send = originalSend;
        res.send(data);
      };
      next();
    }
  };

  // test endpoint
  app.get("/test", cacheMiddleware, (req, res) => {
    // emulate long-running response with a timeout
    setTimeout(
      () =>
        res.send({ value: Math.random(), comment: "I'm an expensive result" }),
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

  // setup redis client
  const redisClient = await setupRedis(io);

  // setup api
  setupApi(app, redisClient);

  // Starting the server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

init();
