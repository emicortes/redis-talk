// Importing required modules
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const path = require("path");
const redis = require("redis");

const setupRedis = async (io) => {
  // Creating a Redis client and subscribing to the chat topic
  const redisConsumer = redis.createClient(
    process.env.REDIS_URL || "localhost"
  );
  const redisPublisher = redisConsumer.duplicate();

  await Promise.all([redisConsumer.connect(), redisPublisher.connect()]);

  return { redisConsumer, redisPublisher };
};

const setupChat = async (io, redisConsumer, redisPublisher) => {
  await redisConsumer.subscribe("chat", (message) =>
    io.emit("message", message)
  );

  // Setting up a Socket.io connection
  io.on("connection", (socket) => {
    console.log("A user has connected.");

    // Sending a message to the client
    socket.emit("message", "Welcome to the chat!");

    // Receiving a message from the client
    socket.on("sendMessage", async (message) => {
      console.log(`User sent message: ${message}`);

      // Sending the message through redis
      await redisPublisher.publish("chat", message);
    });

    // Handling disconnection
    socket.on("disconnect", () => {
      console.log("A user has disconnected.");
    });
  });
};

const init = async () => {
  // Creating the Express app
  const app = express();

  // Setting up a public folder for static files
  const publicDirectoryPath = path.join(__dirname, "./public");
  app.use(express.static(publicDirectoryPath));

  // Setting up a route for the frontend
  app.get("/", (req, res) => {
    res.sendFile(path.join(publicDirectoryPath, "index.html"));
  });

  // Creating the HTTP server and passing in the Express app
  const server = http.createServer(app);

  // Creating the Socket.io server and passing in the HTTP server
  const io = socketio(server);
  const { redisConsumer, redisPublisher } = await setupRedis(io);

  await setupChat(io, redisConsumer, redisPublisher);

  // Starting the server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

init();
