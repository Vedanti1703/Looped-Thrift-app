const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const mongoose = require('mongoose');

// Safety check for OPENAI_API_KEY / MONGO_URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';
const INDEX_NAME = 'product_vector_index';

if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.toLowerCase().includes('your_') || process.env.OPENAI_API_KEY.toLowerCase().includes('placeholder')) {
  console.warn('⚠️ Warning: OPENAI_API_KEY not found or is placeholder in backend/.env');
}

async function createVectorIndex() {
  console.log('🚀 Starting MongoDB Atlas Vector Search index creation...');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const collection = mongoose.connection.db.collection('products');

    // Idempotency check: list search indexes to see if index already exists
    let existingIndexes = [];
    try {
      existingIndexes = await collection.listSearchIndexes().toArray();
    } catch (listErr) {
      console.log('ℹ️ Could not query existing search indexes via listSearchIndexes (proceeding to attempt creation)...');
    }

    const indexExists = existingIndexes.some(idx => idx.name === INDEX_NAME);
    if (indexExists) {
      console.log(`ℹ️ Vector Search index '${INDEX_NAME}' already exists on 'products' collection. Skipping creation.`);
      return;
    }

    const indexDefinition = {
      name: INDEX_NAME,
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 1536,
            similarity: 'cosine',
          },
        ],
      },
    };

    console.log(`Creating Vector Search index '${INDEX_NAME}'...`);
    const result = await collection.createSearchIndex(indexDefinition);
    console.log(`✅ Successfully created Search Index '${INDEX_NAME}'. Index Name: ${result}`);

  } catch (error) {
    console.error(`❌ Failed to create Vector Search index '${INDEX_NAME}':`, error.message);
    console.log('\n--- Common Failure Reasons & Troubleshooting ---');
    console.log('1. Cluster Tier: MongoDB Atlas Vector Search requires an Atlas cluster (M10+ or Atlas Serverless / Flex). Standard local MongoDB instances do not support search indexes.');
    console.log('2. Database User Role: Ensure your connection user has `dbAdmin` or `atlasAdmin` permissions on the target database.');
    console.log('3. Driver Version: Driver must support MongoDB Driver 6.x+ (included in Mongoose 8.x+).');
    console.log('4. Index Already Building: If an index with the same name was recently initiated in Atlas UI, wait for completion.\n');
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createVectorIndex();
