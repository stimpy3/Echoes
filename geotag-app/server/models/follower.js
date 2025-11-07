import mongoose from 'mongoose';

const followerSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

//Prevent duplicate follow entries (same follower/following pair)
//creating index for faster lookup
followerSchema.index({ follower: 1, following: 1 }, { unique: true });

export default mongoose.model('Follower', followerSchema);
