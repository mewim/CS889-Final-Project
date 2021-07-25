const express = require("express");
const router = express.Router();
const axios = require("axios");
const mongoUtil = require("./MongoUtil");
const mongodb = require("mongodb");
const ObjectId = mongodb.ObjectId;

const COLLECTION = "tracks";
const YOUTUBE_API_KEY = "AIzaSyCswwsMxnZ39qTYGC6GGBOWKxydAmyW_2E";
const YOUTUBE_API_URL = "https://youtube.googleapis.com/youtube/v3/search";
router.get("/", async (req, res) => {
  const db = await mongoUtil.getDb();
  const name = req.query.name;
  console.log(name);
  if (!name) {
    return res.sendStatus(400);
  }
  const results = await db
    .collection(COLLECTION)
    .aggregate([
      {
        $match: {
          $text: {
            $search: name,
          },
        },
      },
      { $sort: { score: { $meta: "textScore" }, popularity: -1 } },
      {
        $limit: 100,
      },
      {
        $lookup: {
          from: "artists",
          localField: "artists_id",
          foreignField: "_id",
          as: "artists",
        },
      },
    ])
    .toArray();
  return res.send(results);
});

router.get("/:id/youtube-url", async (req, res) => {
  const db = await mongoUtil.getDb();
  const id = req.params.id;
  if (!mongodb.ObjectId.isValid(id)) {
    return res.sendStatus(400);
  }
  const document = await db.collection(COLLECTION).findOne({
    _id: ObjectId(id),
  });
  if (!document) {
    return res.sendStatus(404);
  }
  const keyword = [
    document.name,
    document.original_artists.join(" "),
    document.release_year,
  ].join(" ");
  console.log(keyword);

  const params = new URLSearchParams([
    ["key", YOUTUBE_API_KEY],
    ["q", keyword],
    ["part", "snippet"],
  ]);

  try {
    const youtubeResults = await axios
      .get(YOUTUBE_API_URL, { params })
      .then((res) => res.data);
    console.log(youtubeResults.items);
    const youtubeId = youtubeResults.items[0].id.videoId;
    const url = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&enablejsapi=1`;
    return res.send({ url });
  } catch (err) {
    return res.sendStatus(500);
  }
});

router.get("/:id", async (req, res) => {
  const db = await mongoUtil.getDb();
  const id = req.params.id;
  if (!mongodb.ObjectId.isValid(id)) {
    return res.sendStatus(400);
  }
  const document = await db.collection(COLLECTION).findOne({
    _id: ObjectId(id),
  });
  if (!document) {
    return res.sendStatus(404);
  }
  res.send(document);
});

module.exports = router;
