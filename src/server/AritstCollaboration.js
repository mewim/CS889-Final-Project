const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");
const mongodb = require("mongodb");
const ObjectId = mongodb.ObjectId;

const COLLECTION = "artistcollaborations";

router.get("/random", async (_, res) => {
  const db = await mongoUtil.getDb();

  const randomDocument = (
    await db
      .collection(COLLECTION)
      .aggregate([
        { $sample: { size: 1 } },
      ])
      .toArray()
  )[0];
  return res.send({ artist_id: randomDocument.artist_1 });
});

router.get("/", async (req, res) => {
  const pivot = req.query.pivot;
  let depth = parseInt(req.query.depth);
  if (!depth) {
    depth = 1;
  }
  let fetchAllEdges = req.query.fetch_all_edges === "true";

  const db = await mongoUtil.getDb();
  if (!mongodb.ObjectId.isValid(pivot)) {
    return res.sendStatus(400);
  }

  const results = [];
  let nextQuery = [new ObjectId(pivot)];
  const visitedSet = new Set();

  for (let i = 0; i < depth; ++i) {
    const currArtistResults = await db
      .collection(COLLECTION)
      .find({
        $or: [
          { artist_1: { $in: nextQuery } },
          { artist_2: { $in: nextQuery } },
        ],
      })
      .toArray();
    let currResult;
    if (fetchAllEdges) {
      const currArtistSet = new Set();
      currArtistResults.forEach((a) => {
        currArtistSet.add(a.artist_1.toHexString());
        currArtistSet.add(a.artist_2.toHexString());
      });

      const currArtists = Array.from(currArtistSet).map((i) => new ObjectId(i));
      currResult = await db
        .collection(COLLECTION)
        .find({
          $and: [
            { artist_1: { $in: currArtists } },
            { artist_2: { $in: currArtists } },
          ],
        })
        .toArray();
    } else {
      currResult = currArtistResults;
    }
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
