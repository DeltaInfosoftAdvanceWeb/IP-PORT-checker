
import mongoose from "mongoose";
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
   
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique:true
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'UserData',
  }
);

const User = mongoose.models.UserData || mongoose.model('UserData', UserSchema);

export default User;


