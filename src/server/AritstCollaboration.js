const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");
const mongodb = require("mongodb");
const ObjectId = mongodb.ObjectId;

const COLLECTION = "artistcollaborations";

router.get("/", async (req, res) => {
  const pivot = req.query.pivot;
  let depth = parseInt(req.query.depth);
  if (!depth) {
    depth = 1;
  }

  const db = await mongoUtil.getDb();
  if (!mongodb.ObjectId.isValid(pivot)) {
    return res.sendStatus(400);
  }

  const results = [];
  let nextQuery = [new ObjectId(pivot)];
  const visitedSet = new Set();

  for (let i = 0; i < depth; ++i) {
    const currResult = await db
      .collection(COLLECTION)
      .find({
        $or: [
          { artist_1: { $in: nextQuery } },
          { artist_2: { $in: nextQuery } },
        ],
      })
      .toArray();

    nextQuery.forEach((oid) => {
      visitedSet.add(oid.toHexString());
    });
    nextQuery = [];
    currResult.forEach((r) => {
      results.push(r);
      if (!visitedSet.has(r.artist_1.toHexString())) {
        nextQuery.push(r.artist_1);
      }
      if (!visitedSet.has(r.artist_2.toHexString())) {
        nextQuery.push(r.artist_2);
      }
    });
  }
  const artists = await db
    .collection("artists")
    .find({
      _id: {
        $in: Array.from(visitedSet)
          .map((a) => new ObjectId(a))
          .concat(nextQuery),
      },
    })
    .toArray();
  console.log(results);
  res.send({ artists, relationships: results });
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
