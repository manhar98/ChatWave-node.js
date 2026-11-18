
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    profilePic: {
      type: String,
      default: "",
    },

    bio: {
      type: String,
      default: "",
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Password save કરતાં પહેલાં Hash થશે
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);

  this.password = await bcrypt.hash(
    this.password,
    salt
  );
});

// Login સમયે Password ચેક કરવા
userSchema.methods.comparePassword = async function (
  enteredPassword
) {
  return await bcrypt.compare(
    enteredPassword,
    this.password
  );
};

const User = mongoose.model("User", userSchema);

export default User;
