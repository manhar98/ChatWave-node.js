
import User from "../models/User.js";

// Get My Profile
export const getMyProfile = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user: req.user,
    });
  } catch (error) {
    console.log("Get Profile Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Update My Profile
export const updateMyProfile = async (req, res) => {
  try {
    const { fullName, bio } = req.body;

    const updateData = {};

    // Validate Full Name
    if (fullName !== undefined) {
      if (!fullName.trim()) {
        return res.status(400).json({
          success: false,
          message: "Full name cannot be empty",
        });
      }

      updateData.fullName = fullName.trim();
    }

    // Update Bio
    if (bio !== undefined) {
      updateData.bio = bio.trim();
    }

    // Update Profile Picture (if uploaded)
    if (req.file) {
      updateData.profilePic = `/uploads/${req.file.filename}`;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide profile details to update",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.log("Update Profile Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Search Users
export const searchUsers = async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword || keyword.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Please enter a search keyword",
      });
    }

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        {
          fullName: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          email: {
            $regex: keyword,
            $options: "i",
          },
        },
      ],
    })
      .select("-password")
      .limit(20);

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      totalUsers: users.length,
      users,
    });
  } catch (error) {
    console.log("Search Users Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
  