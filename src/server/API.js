const express = require("express");
const router = express.Router();

const track = require("./Track");
const artist = require("./Artist");

router.use("/track", track);
router.use("/artist", artist);

router.use((_, res) => {
  return res.sendStatus(501);
});

module.exports = router;
