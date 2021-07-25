const express = require("express");
const router = express.Router();

// define the home page route
router.get("/", async (req, res) => {
  res.send({
    status: "success",
    time: new Date(),
  });
});

module.exports = router;
