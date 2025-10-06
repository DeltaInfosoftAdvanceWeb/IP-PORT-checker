// import mongoose from "mongoose";

// let isConnected = false;

// const MAX_RETRIES = 5;
// const INITIAL_BACKOFF = 1000;

// async function connectWithRetry(mongoUrl, options, retryCount = 0) {
//     try {
//         console.log(`Attempting to connect to MongoDB (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
//         const connection = await mongoose.connect(mongoUrl, options);
//         isConnected = true;
//         console.log("MongoDB connected successfully");
//         return connection;
//     } catch (error) {
//         if (retryCount < MAX_RETRIES - 1) {
//             const backoffTime = INITIAL_BACKOFF * Math.pow(2, retryCount);
//             console.log(`Connection failed. Retrying in ${backoffTime / 1000} seconds...`);
//             await new Promise(resolve => setTimeout(resolve, backoffTime));
//             return connectWithRetry(mongoUrl, options, retryCount + 1);
//         } else {
//             console.error("Max retries reached. Unable to connect to MongoDB.");
//             throw error;
//         }
//     }
// }

// export async function connectToDatabase() {
//     if (isConnected) {
//         console.log("Using existing MongoDB connection");
//         return mongoose.connection;
//     }

//     const mongoUrl = process.env.MONGOURL || '';

//     const options = {
//         serverSelectionTimeoutMS: 5000,
//         connectTimeoutMS: 10000,
//         socketTimeoutMS: 45000,
//         family: 4
//     };

//     try {
//         await connectWithRetry(mongoUrl, options);

//         mongoose.connection.on('error', (error) => {
//             console.error('MongoDB connection error:', error);
//             isConnected = false;
//             // Attempt to reconnect
//             connectToDatabase().catch(err => console.error('Failed to re-establish connection:', err));
//         });

//         return mongoose.connection;
//     } catch (error) {
//         console.error('Failed to connect to MongoDB after multiple retries:', error);
//         throw error;
//     }
// }

// // Graceful shutdown
// process.on("SIGINT", gracefulShutdown);
// process.on("SIGTERM", gracefulShutdown);

// async function gracefulShutdown() {
//     if (isConnected) {
//         try {
//             console.log("Closing MongoDB connection...");
//             await mongoose.connection.close();
//             console.log("MongoDB connection closed successfully");
//         } catch (error) {
//             console.error("Error while closing MongoDB connection:", error);
//         }
//     }
//     process.exit(0);
// }



import mongoose from 'mongoose';

const MONGO_URL = process.env.MONGOURL;

if (!MONGO_URL) {
  throw new Error('Please define the MONGOURL environment variable');
}

interface CachedConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

let cached: CachedConnection = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

const connectOptions: mongoose.ConnectOptions = {
  bufferCommands: false,
  autoIndex: false,
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4
};


export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGO_URL!, connectOptions).then((mongoose) => {
      console.log('New database connection established');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
