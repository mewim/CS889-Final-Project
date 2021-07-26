const express = require("express");
const router = express.Router();

const track = require("./Track");
const artist = require("./Artist");
const aritstcollaboration = require("./AritstCollaboration");

router.use("/track", track);
router.use("/artist", artist);
router.use("/aritstcollaboration", aritstcollaboration);

router.use((_, res) => {
  return res.sendStatus(501);
});

module.exports = router;
