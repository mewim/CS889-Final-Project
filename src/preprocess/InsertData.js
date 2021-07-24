const csv = require("csv-parser");
const fs = require("fs");
const mongodb = require("mongodb");

const MONGO_URI =
  "mongodb://admin:ZeYyVGHQ8W37WWCq9EdiMyQaN8zHKZGw@cs889-db.mew.im:23333/?authSource=admin";

const parseArtists = () => {
  const results = [];
  const originalIdMapping = {};
  return new Promise((resolve, rejcet) => {
    fs.createReadStream("../../data/artists.csv")
      .pipe(csv())
      .on("data", (data) => {
        data.genres = eval(data.genres);
        data.original_id = data.id;
        for (attr of ["followers", "popularity"]) {
          data[attr] = Number(data[attr]);
        }
        delete data.id;
        data._id = new mongodb.ObjectId();
        originalIdMapping[data.original_id] = data._id;
        results.push(data);
      })
      .on("end", () => {
        return resolve({
          artists: results,
          idMap: originalIdMapping,
        });
      });
  });
};

const parseSongs = (idMap) => {
  const results = [];
  let found = 0;
  let notFound = 0;
  return new Promise((resolve, rejcet) => {
    fs.createReadStream("../../data/tracks.csv")
      .pipe(csv())
      .on("data", (data) => {
        data.original_id_artists = eval(data.id_artists);
        data.original_artists = eval(data.artists);
        data.original_id = data.id;
        delete data.id;
        delete data.id_artists;
        delete data.artists;
        data.artists_id = data.original_id_artists
          .map((o) => {
            if (!idMap[o]) {
              ++notFound;
            } else {
              ++found;
            }
            return idMap[o];
          })
          .filter((o) => Boolean(o));
        for (attr of [
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
        ]) {
          data[attr] = Number(data[attr]);
        }
        data.explicit = data.explicit === "1";
        data.mode = data.mode === "1";
        data._id = new mongodb.ObjectId();
        data.release_year = parseInt(data.release_date.slice(0, 4));
        results.push(data);
      })
      .on("end", () => {
        console.log(found, "artists matched");
        console.log(notFound, "artists not matched");
        return resolve(results);
      });
  });
};

const connectMongo = async () => {
  const client = new mongodb.MongoClient(MONGO_URI, {
    useUnifiedTopology: true,
  });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Connected successfully to MongoDB");
    return client;
  } catch (err) {
    console.log("Cannot connect to MongoDB", err);
  }
};

const main = async () => {
  console.log("Parsing artists...");
  const { artists, idMap } = await parseArtists();
  console.log(artists.length, "artists extracted");
  console.log("Parsing tracks...");
  const songs = await parseSongs(idMap);
  console.log(songs.length, "tracks extracted");
  console.log("Connecting to MongoDB...");
  const mongoClient = await connectMongo();
  const db = mongoClient.db("spotify");
  console.log("Inserting to MongoDB...");
  await db.collection("tracks").insertMany(songs);
  await db.collection("artists").insertMany(artists);
  console.log("Insertion success");
  mongoClient.close();
  console.log("Disconnected from MongoDB");
  process.exit(1);
};

main();
