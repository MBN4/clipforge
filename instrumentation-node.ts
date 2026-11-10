// Background clip jobs run in this same process — an unrelated uncaught
// error (e.g. a client aborting a video stream) must not take the whole
// server, and every in-flight job, down with it.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] swallowed to keep the server alive:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection] swallowed to keep the server alive:", err);
});

export {};
