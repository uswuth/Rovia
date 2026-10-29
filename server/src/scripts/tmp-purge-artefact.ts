import dotenv from 'dotenv';
import path from 'node:path';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI missing');
  process.exit(1);
}

/** SRV lookups are refused on this machine, so the shard hosts are addressed directly. */
const directUri = (srvUri: string): string => {
  const match = srvUri.match(/^mongodb\+srv:\/\/([^@]+)@([^/]+)\/([^?]*)/);
  if (!match || !match[2].endsWith('.lztu59q.mongodb.net')) return srvUri;
  const [, credentials, , dbName] = match;
  const hosts = [0, 1, 2]
    .map((index) => `ac-yjzdnff-shard-00-0${index}.lztu59q.mongodb.net:27017`)
    .join(',');
  return (
    `mongodb://${credentials}@${hosts}/${dbName}` +
    '?authSource=admin&replicaSet=atlas-4kkiuv-shard-0&ssl=true&retryWrites=true&w=majority'
  );
};

/** Whisper's Japanese "thank you for watching" artefact. */
const ARTEFACT = /\u3054\u8996\u8074|thank you for watching/i;

const main = async (): Promise<void> => {
  await mongoose.connect(directUri(uri));
  const db = mongoose.connection.db;
  if (!db) throw new Error('no db handle');
  console.log('database:', db.databaseName);

  const candidates = await db
    .collection('transcripts')
    .find({}, { projection: { transcript_text: 1 } })
    .toArray();

  const targets = candidates.filter((doc) => ARTEFACT.test(String(doc.transcript_text ?? '')));
  console.log('transcript documents:', candidates.length);
  console.log('artefact documents:', targets.length);

  for (const doc of targets) {
    const transcriptId = doc._id as mongoose.Types.ObjectId;
    const text = String(doc.transcript_text ?? '');
    console.log(
      'deleting transcript:',
      String(transcriptId),
      '| recording:',
      String((doc as { recording_id?: unknown }).recording_id),
      '| preview:',
      text.slice(0, 60).replace(/\s+/g, ' ')
    );

    const summaries = await db
      .collection('summaries')
      .find({ transcript_id: transcriptId }, { projection: { _id: 1 } })
      .toArray();
    for (const summary of summaries) {
      console.log('deleting summary:', String(summary._id));
    }

    const transcriptResult = await db.collection('transcripts').deleteOne({ _id: transcriptId });
    const summaryResult = await db.collection('summaries').deleteMany({ transcript_id: transcriptId });
    console.log('deleted transcripts:', transcriptResult.deletedCount, '| summaries:', summaryResult.deletedCount);
  }

  console.log('remaining transcripts:', await db.collection('transcripts').countDocuments());
  console.log('remaining summaries:', await db.collection('summaries').countDocuments());
};

await main();
await mongoose.disconnect();
