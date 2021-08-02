const express = require("express");
const router = express.Router();
const axios = require("axios");
const mongoUtil = require("./MongoUtil");
const mongodb = require("mongodb");
const ObjectId = mongodb.ObjectId;

const COLLECTION = "tracks";
const YOUTUBE_API_KEY = "AIzaSyCswwsMxnZ39qTYGC6GGBOWKxydAmyW_2E";
const YOUTUBE_API_URL = "https://youtube.googleapis.com/youtube/v3/search";
const YOUTUBE_WEB_SEARCH = "https://www.youtube.com/results";

const AGGREGATION_FIELDS = [
  "duration_ms",
  "danceability",
  "energy",
  "popularity",
  "key",
  "loudness",
  "speechiness",
  "acousticness",
  "instrumentalness",
  "liveness",
  "valence",
  "tempo",
  "time_signature",
];

const aggregateAttributesByYear = async (startYear, endYear) => {
  const db = await mongoUtil.getDb();
  const $match = { release_year: {} };
  if (startYear) {
    $match.release_year.$gte = startYear;
  }
  if (endYear) {
    $match.release_year.$lte = endYear;
  }

  const $group = { _id: null };
  const MIN = "min";
  const MAX = "max";
  const AVG = "avg";
  for (let f of AGGREGATION_FIELDS) {
    for (let o of [MIN, MAX, AVG]) {
      const operation = {};
      operation["$" + o] = "$" + f;
      $group[`${o}_${f}`] = operation;
    }
  }
  $group.count = { $sum: 1 };
  const pipeline = [
    { $match },
    { $group },
    {
      $project: {
        _id: false,
      },
    },
  ];
  const collection = db.collection(COLLECTION);
  const aggregationResult = await collection.aggregate(pipeline).toArray();
  const formattedAggregationResult = {};
  for (let f of AGGREGATION_FIELDS) {
    formattedAggregationResult[f] = {};
    for (let o of [MIN, MAX, AVG]) {
      formattedAggregationResult[f][o] = aggregationResult[0][`${o}_${f}`];
    }
    formattedAggregationResult.count = aggregationResult[0].count;
  }
  return formattedAggregationResult;
};

const getUrlFromYoutubeId = (youtubeId) => {
  return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&enablejsapi=1`;
};

const getYoutubeUrlFromAPI = async (keyword) => {
  const params = new URLSearchParams([
    ["key", YOUTUBE_API_KEY],
    ["q", keyword],
    ["part", "snippet"],
  ]);

  const youtubeResults = await axios
    .get(YOUTUBE_API_URL, { params })
    .then((res) => res.data);
  const youtubeId = youtubeResults.items[0].id.videoId;
  const url = getUrlFromYoutubeId(youtubeId);
  return url;
};

const getYoutubeUrlAlternative = async (keyword) => {
  const params = new URLSearchParams([["search_query", keyword]]);
  const youtubeResults = await axios
    .get(YOUTUBE_WEB_SEARCH, {
      params,
      headers: {
        "Accept-Encoding": "gzip, deflate, br",
      },
    })
    .then((res) => res.data);
  const stringWithFirstLink = youtubeResults.split(`url":"/watch?v=`)[1];
  const firstId = stringWithFirstLink.split('"')[0];
  return getUrlFromYoutubeId(firstId);
};

router.get("/", async (req, res) => {
  const db = await mongoUtil.getDb();
  const name = req.query.name;
  if (!name) {
    return res.sendStatus(400);
  }
  let limit = parseInt(req.query.limit);
  if (!limit) {
    limit = 100;
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
        $limit: limit,
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

router.get("/aggregation/:start/:end", async (req, res) => {
  const startYear = parseInt(req.params.start);
  const endYear = parseInt(req.params.end);
  if (!startYear && !endYear) {
    return req.sendStatus(400);
  }

  const formattedAggregationResult = await aggregateAttributesByYear(
    startYear,
    endYear
  );
  return res.send(formattedAggregationResult);
});

router.get("/top-songs/", async (req, res) => {
  const startYear = parseInt(req.query.start_year);
  const endYear = parseInt(req.query.end_year);
  let limit = parseInt(req.query.limit);
  if (!limit) {
    limit = 100;
  }
  const $match = { release_year: {} };
  if (startYear) {
    $match.release_year.$gte = startYear;
  }
  if (endYear) {
    $match.release_year.$lte = endYear;
  }

  const pipeline = [
    { $sort: { popularity: -1 } },
    {
      $limit: limit,
    },
    {
      $lookup: {
        from: "artists",
        localField: "artists_id",
        foreignField: "_id",
        as: "artists",
      },
    },
  ];
  if (startYear || endYear) {
    pipeline.unshift({ $match });
  }
  const db = await mongoUtil.getDb();
  const results = await db
    .collection(COLLECTION)
    .aggregate(pipeline)
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
  try {
    // const url = await getYoutubeUrlFromAPI(keyword);
    const url = await getYoutubeUrlAlternative(keyword);
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

router.get("/combination/:a/:b", async (req, res) => {
  const db = await mongoUtil.getDb();
  attrs = req.params.a.split(",");
  const embeddingtype = await db.collection("trackembeddingtypes").findOne({
    attributes: attrs,
  });
  const documents = await db.collection("tracktsneembeddings")
    .aggregate([
    {
      '$match': {
        track_embedding_type_id: {'$eq': embeddingtype._id},
      },
    },
    {
      '$lookup': {
        'from': 'tracks',
        'localField': 'track_id',
        'foreignField': '_id',
        'as': 'info',
      },
    },
    {
      '$unwind': '$info',
    },
    {
      '$match': {
        'info.popularity': {'$gte': parseInt(req.params.b)},
      }
    },
    {
      '$limit': 2000,
    },
    // {
    //   '$count': 'num_rows',
    // } 
  ]).toArray();
  res.send(documents);
});

module.exports = router;
