const mongodb = require("mongodb");

const MONGO_URI =
  "mongodb://admin:ZeYyVGHQ8W37WWCq9EdiMyQaN8zHKZGw@cs889-db.mew.im:23333/?authSource=admin";

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
  console.log("Connecting to MongoDB...");
  const mongoClient = await connectMongo();
  const db = mongoClient.db("spotify");
  console.log("Fetching tracks with more than one artists from MongoDB...");
  const queryResults = await db
    .collection("tracks")
    .find({ $where: "this.artists_id.length > 1" }, { artists_id: 1, _id: 1 })
    .toArray();
  console.log(queryResults.length, "tracks fetched");

  const hash = {};

  for (r of queryResults) {
    const currArtists = r.artists_id.sort();
    for (let i = 0; i < currArtists.length - 1; ++i) {
      for (let j = i + 1; j < currArtists.length; ++j) {
        const artist1 = currArtists[i];
        const artist2 = currArtists[j];
        if (!hash[artist1]) {
          hash[artist1] = {};
        }
        if (!hash[artist1][artist2]) {
          hash[artist1][artist2] = 0;
        }
        hash[artist1][artist2] += 1;
      }
    }
  }

  const flattend = [];
  for (let artist_1 in hash) {
    for (let artist_2 in hash[artist_1]) {
      const count = hash[artist_1][artist_2];
      flattend.push({
        artist_1: mongodb.ObjectId(artist_1),
        artist_2: mongodb.ObjectId(artist_2),
        count,
      });
    }
  }
  console.log(flattend.length, "relationships has been extracted");

  console.log("Inserting to database...");

  await db.collection("artistcollaborations").insertMany(flattend);
  console.log("Extracted relationships has been inserted to database");

  mongoClient.close();
  console.log("Disconnected from MongoDB");
  console.log("All done");
  process.exit(0);
};

main();
