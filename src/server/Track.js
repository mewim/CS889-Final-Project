const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");
const mongodb = require("mongodb");
const ObjectId = mongodb.ObjectId;

const COLLECTION = "tracks";

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
