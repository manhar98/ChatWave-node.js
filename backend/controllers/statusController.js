
import Status from "../models/Status.js";

// Upload Status
export const uploadStatus = async (req, res) => {
  try {
    const { caption, mediaType } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image or video",
      });
    }

    if (!["image", "video"].includes(mediaType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid media type",
      });
    }

    const status = await Status.create({
      user: req.user._id,
      media: `/uploads/${req.file.filename}`,
      mediaType,
      caption: caption || "",
    });

    const populatedStatus = await Status.findById(status._id)
      .populate("user", "fullName profilePic");

    return res.status(201).json({
      success: true,
      message: "Status uploaded successfully",
      status: populatedStatus,
    });
  } catch (error) {
    console.log("Upload Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload status",
    });
  }
};

// Get All Active Status
export const getAllStatus = async (req, res) => {
  try {
    const statuses = await Status.find({
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "fullName profilePic")
      .populate("viewers.user", "fullName profilePic")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      statuses,
    });
  } catch (error) {
    console.log("Get Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get statuses",
    });
  }
};

// Delete My Status
export const deleteStatus = async (req, res) => {
  try {
    const status = await Status.findOne({
      _id: req.params.statusId,
      user: req.user._id,
    });

    if (!status) {
      return res.status(404).json({
        success: false,
        message: "Status not found",
      });
    }

    await Status.findByIdAndDelete(status._id);

    return res.status(200).json({
      success: true,
      message: "Status deleted successfully",
    });
  } catch (error) {
    console.log("Delete Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete status",
    });
  }
};

// View Status
export const viewStatus = async (req, res) => {
  try {
    const status = await Status.findOne({
      _id: req.params.statusId,
      expiresAt: { $gt: new Date() },
    });

    if (!status) {
      return res.status(404).json({
        success: false,
        message: "Status not found or expired",
      });
    }

    if (status.user.toString() !== req.user._id.toString()) {
      const alreadyViewed = status.viewers.some(
        (viewer) =>
          viewer.user.toString() === req.user._id.toString()
      );

      if (!alreadyViewed) {
        status.viewers.push({
          user: req.user._id,
          viewedAt: new Date(),
        });

        await status.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Status viewed successfully",
      status,
    });
  } catch (error) {
    console.log("View Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to view status",
    });
  }
};
