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
    { title: 'Duration', field: 'duration_ms', unit: 'ms' }, 
    { title: 'Danceability', field: 'danceability' }, 
    { title: 'Energy', field: 'energy' }, 
    { title: 'Popularity', field: 'popularity' }, 
    { title: 'Key', field: 'key' }, 
    { title: 'Loudness', field: 'loudness', unit: 'dB' }, 
    { title: 'Speechiness', field: 'speechiness' }, 
    { title: 'Acousticness', field: 'acousticness' }, 
    { title: 'Instrumentalness', field: 'instrumentalness' }, 
    { title: 'Liveness', field: 'liveness' }, 
    { title: 'Valence', field: 'valence' }, 
    { title: 'Tempo', field: 'tempo', unit: 'BPM' }, 
    { title: 'Time Signature', field: 'time_signature' },
    // { title: 'Genre', field: 'genre' },
    { title: 'Year', field: 'release_year' }
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
      operation["$" + o] = "$" + f.field;
      $group[`${o}_${f.field}`] = operation;
    }
  }
  $group.count = { $sum: 1 };
  const pipeline = [
    { $group },
    {
      $project: {
        _id: false,
      },
    },
  ];
  if (startYear || endYear) {
      pipeline.unshift({ $match });
  }
  
  const collection = db.collection(COLLECTION);
  const aggregationResult = await collection.aggregate(pipeline).toArray();
  //console.log('aggregationResult:', aggregationResult);
  
  const formattedAggregationResult = {};
  for (let f of AGGREGATION_FIELDS) {
    formattedAggregationResult[f.field] = Object.assign({}, f);
    for (let o of [MIN, MAX, AVG]) {
      formattedAggregationResult[f.field][o] = aggregationResult[0][`${o}_${f.field}`];
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

router.get("/aggregation/", async (req, res) => {
  const startYear = parseInt(req.query.start);
  const endYear = parseInt(req.query.end);

  const formattedAggregationResult = await aggregateAttributesByYear(startYear, endYear);
  return res.send(formattedAggregationResult);
});

router.get("/aggregation-by-year/", async (req, res) => {
    const attr = req.query.attribute || 'liveness';
    const startYear = parseInt(req.query.start);
    const endYear = parseInt(req.query.end);
    
    const $match = { release_year: {} };
    if (startYear) {
        $match.release_year.$gte = startYear;
    }
    if (endYear) {
        $match.release_year.$lte = endYear;
    }
    
    const pipeline = [
        { 
            $group: {
                _id: "$release_year", 
                avg: { $avg: '$' + attr }
            }
        }, 
        { 
            $project: {
                _id: 0, 
                year: '$_id', 
                avg: 1
            }
        }, 
        {
            $sort: { year: 1 }
        }
    ];
    if (startYear || endYear) {
        pipeline.unshift({ $match });
    }
    
    const db = await mongoUtil.getDb();
    const collection = db.collection(COLLECTION);
    const result = await collection.aggregate(pipeline).toArray();
    return res.send(result);
});

router.get("/top-songs/", async (req, res) => {
  const startYear = parseInt(req.query.start);
  const endYear = parseInt(req.query.end);
  const currentAttr = req.query.attribute;
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
  
  const $project = {
      id: 1,
      name: 1, 
      release_date: 1,
      release_year: 1,
      genre: "$key",  // temp fix
      popularity: 1, 
      artists: 1
  };
  if (currentAttr) {
      $project[currentAttr] = 1;
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
  if (currentAttr) {
      pipeline.push({ $project });
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
  
  /*const document = await db.collection(COLLECTION).findOne({
    _id: ObjectId(id),
  });*/
  
  const pipeline = [
      {
        $match: {
          _id: ObjectId(id)
        }
      },
      {
        $lookup: {
          from: "artists",
          localField: "artists_id",
          foreignField: "_id",
          as: "artists",
        }
      }
  ];
  
  const results = await db
    .collection(COLLECTION)
    .aggregate(pipeline)
    .toArray();
  
  const document = results[0];
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

router.get("/combinationSingle/:a/:id", async (req, res) => {
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
        'track_id': {'$eq': new ObjectId(req.params.id)},
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
    // {
    //   '$count': 'num_rows',
    // } 
  ]).toArray();
  res.send(documents);
});

router.get("/artist/:id", async (req, res) => {
  const db = await mongoUtil.getDb();
  const documents = await db.collection("tracks")
    .aggregate([
    {
      '$match': {
        'artists_id': {
          '$elemMatch': {
            '$eq': new ObjectId(req.params.id),
          }
        }
      },
    },
    {
      '$sort': {'popularity': -1},
    },
    {
      '$limit': 10,
    },
  ]).toArray();
  res.send(documents);
});

module.exports = router;
