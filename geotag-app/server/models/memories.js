const mongoose=require('mongoose');

const memorySchema=new mongoose.Schema({

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category:{ type:String, enum:["Travel","Nature","Food","Events","People","Milestones","Culture","Other"]},
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: { type: [Number], required: true }, // [lng, lat]
    address: { type: String, required: true }
  },
  photoUrl: { type: String, required: true },
  embedding: { type: [Number], select: false }, // Store embeddings but don't select by default
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

// 2dsphere index for geospatial queries
memorySchema.index({ location: '2dsphere' });


module.exports= mongoose.model('Memory',memorySchema);

/*
GeoJSON is a standard JSON format to represent geographic data. A point looks like this:
{
  "type": "Point",
  "coordinates": [longitude, latitude]
}

MongoDB understands this format for geospatial queries like $near. 
impotant for using location-based features in your app.

Why it’s needed

Without a 2dsphere index:
MongoDB doesn’t know location contains geographical coordinates.
Geospatial queries like $near, $geoWithin, $nearSphere will not work.
Queries would be slow if MongoDB had to scan every document.

With a 2dsphere index:
MongoDB can efficiently calculate distances between points on Earth.
You can query “memories near me” or “memories within 5 km” quickly.


Why a “2dsphere” Index Is Different

Most indexes deal with numbers or text.
A 2dsphere index is special — it’s designed for geographical data (longitude/latitude).
It doesn’t just sort by number order — it understands Earth’s spherical geometry.
That means it can efficiently answer questions like:
“Which memories are within 5 km of this point?”

That’s not simple sorting — that’s distance-based searching on a curved surface (Earth).
 */