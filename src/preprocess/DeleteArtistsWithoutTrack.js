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
  console.log("Fetching artists with tracks from MongoDB...");
  const aggregationResult = await db
    .collection("tracks")
    .aggregate([
      {
        $project: {
          artists_id: true,
          _id: false,
        },
      },
      {
        $unwind: {
          path: "$artists_id",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: null,
          artists_ids: {
            $addToSet: "$artists_id",
          },
        },
      },
    ])
    .toArray();

  const artistsWithTracks = aggregationResult[0].artists_ids;
  console.log(
    "There are",
    artistsWithTracks.length,
    "artists with at least one track"
  );

  console.log("Deleting artists without tracks from MongoDB...");
  await db
    .collection("artists")
    .deleteMany({ _id: { $nin: artistsWithTracks } });
  console.log("All done");

  mongoClient.close();
  console.log("Disconnected from MongoDB");
  process.exit(0);
};

main();
