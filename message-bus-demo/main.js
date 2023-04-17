// Importing required modules
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const path = require("path");
const redis = require("redis");

// redis client setup (consumer and publisher)
const setupRedis = async () => {
  // Creating a Redis client and subscribing to the chat topic
  const redisConsumer = redis.createClient(
    process.env.REDIS_URL || "localhost"
  );
  const redisPublisher = redisConsumer.duplicate();

  await Promise.all([redisConsumer.connect(), redisPublisher.connect()]);

  return { redisConsumer, redisPublisher };
};

// sockets setup
const setupSockets = async (io, redisConsumer, redisPublisher) => {
  // setup pub/sub callback 
  await redisConsumer.subscribe("chat", (message) =>
    //send the message to all clients
    io.emit("message", message)
  );

  // setup client welcome
  io.on("connection", (socket) => {
    console.log("A user has connected.");
    // Receiving a message from the client
    socket.on("sendMessage", async (message) => {
      console.log(`User sent message: ${message}`);

      // Sending the message through redis
      await redisPublisher.publish("chat", message);
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

  // setup redis consumers and publishers
  const { redisConsumer, redisPublisher } = await setupRedis(io);

  // setup sockets
  await setupSockets(io, redisConsumer, redisPublisher);

  // Starting the server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

init();
