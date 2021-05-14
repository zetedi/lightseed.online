import { presents } from './data';

export async function insertSeedData(ks: any) {
  // Keystone API changed, so we need to check for both versions to get keystone
  const keystone = ks.keystone || ks;
  const adapter = keystone.adapters?.MongooseAdapter || keystone.adapter;

  console.log(`Inserting Seed Data: ${presents.length} Presents`);
  const { mongoose } = adapter;
  for (const present of presents) {
    console.log(`Adding Present: ${present.name}`);
    const { _id } = await mongoose
      .model('PresentImage')
      .create({ image: present.photo, altText: present.body });
    present.photo = _id;
    await mongoose.model('Present').create(present);
  }
  console.log(`Seed Data Inserted: ${presents.length} Presents`);
  console.log('Please start the process with `yarn dev` or `npm run dev`');
  process.exit();
}
