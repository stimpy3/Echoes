const mongoose=require('mongoose');

const followRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true } /*MongoDB/Mongoose automatically adds:
createdAt → when this document was first saved
updatedAt → when this document was last changed */
);

// prevent duplicates
followRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });
/*
unique: true makes sure:
One sender → one receiver = only one follow request allowed.
 */

module.exports= mongoose.model("FollowRequest", followRequestSchema);
