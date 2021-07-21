const express = require("express");
const api = require("./api");

module.exports = (app) => {
  app.use(express.json());
  app.use("/api", api);
};
