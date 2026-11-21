
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Save, User, Mail, FileText, Trash2 } from "lucide-react";
import API from "../utils/api";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://chatwave-node-js.onrender.com/api";

// Strip trailing /api if present to get server root URL
const SERVER_URL = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

function Profile() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [preview, setPreview] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch Profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await API.get("/users/profile");

        const user = data.user;

        setFullName(user.fullName || "");
        setEmail(user.email || "");
        setBio(user.bio || "");
        setProfilePic(user.profilePic || "");

        localStorage.setItem("user", JSON.stringify(user));
      } catch (err) {
        console.log("Profile Error:", err);

        setError(
          err.response?.data?.message || "Profile load થઈ શક્યું નથી."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Select Profile Image
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("કૃપા કરીને Image File પસંદ કરો.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image 5 MB કરતાં નાની હોવી જોઈએ.");
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setError("");
    setSuccess("");
  };

  // Update Profile
  const handleSubmit = async (e) => {    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const formData = new FormData();

      formData.append("fullName", fullName);
      formData.append("bio", bio);

      if (selectedFile) {
        formData.append("profilePic", selectedFile);
      }

      const { data } = await API.put("/users/profile", formData);

      const updatedUser = data.user;

      localStorage.setItem("user", JSON.stringify(updatedUser));

      setFullName(updatedUser.fullName || "");
      setEmail(updatedUser.email || "");
      setBio(updatedUser.bio || "");
      setProfilePic(updatedUser.profilePic || "");

      setSelectedFile(null);
      setPreview("");

      setSuccess("Profile successfully updated!");
    } catch (err) {
      console.log("Update Profile Error:", err);

      setError(
        err.response?.data?.message || "Profile update થઈ શક્યું નથી."
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "શું તમે ખરેખર તમારો account delete કરવા માંગો છો?\nઆ action undo નહીં થઈ શકે."
    );
    if (!confirmed) return;
    try {
      setDeleting(true);
      setError("");
      await API.delete("/users/account");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth-change"));
      window.location.href = "/register";
    } catch (err) {
      console.log("Delete Account Error:", err);
      setError(err.response?.data?.message || "Account delete થઈ શક્યો નથી.");
    } finally {
      setDeleting(false);
    }
  };

  const imageUrl = preview
    ? preview
    : profilePic
      ? profilePic.startsWith("http")
        ? profilePic
        : `${SERVER_URL}${profilePic}`
      : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080711] flex items-center justify-center text-purple-400">
        Loading Profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080711] text-white p-5 md:p-10">

      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mt-6">
          My <span className="text-purple-400">Profile</span>
        </h1>

        <p className="text-gray-400 mt-2">
          Manage your personal information
        </p>
      </div>

      {/* Profile Card */}
      <div className="max-w-3xl mx-auto bg-[#12101d] border border-purple-500/20 rounded-3xl p-6 md:p-10 shadow-2xl">

        <form onSubmit={handleSubmit}>

          {/* Profile Image */}
          <div className="flex flex-col items-center mb-10">

            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-purple-600 overflow-hidden flex items-center justify-center border-4 border-purple-500/30">

                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={55} />
                )}

              </div>

              <label className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center cursor-pointer border-4 border-[#12101d]">
                <Camera size={18} />

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>

            <p className="text-gray-400 text-sm mt-4">
              Click camera icon to change photo
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-5">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-xl mb-5">
              {success}
            </div>
          )}

          {/* Full Name */}
          <div className="mb-5">
            <label className="block text-sm text-gray-300 mb-2">
              Full Name
            </label>

            <div className="flex items-center gap-3 bg-[#1b1928] border border-gray-700 rounded-xl px-4">
              <User size={19} className="text-purple-400" />

              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-transparent py-4 outline-none"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          {/* Email */}
          <div className="mb-5">
            <label className="block text-sm text-gray-300 mb-2">
              Email Address
            </label>

            <div className="flex items-center gap-3 bg-[#1b1928] border border-gray-700 rounded-xl px-4 opacity-70">
              <Mail size={19} className="text-purple-400" />

              <input
                type="email"
                value={email}
                readOnly
                className="w-full bg-transparent py-4 outline-none cursor-not-allowed"
              />
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Email address cannot be changed here.
            </p>
          </div>

          {/* Bio */}
          <div className="mb-8">
            <label className="block text-sm text-gray-300 mb-2">
              About Me
            </label>

            <div className="flex items-start gap-3 bg-[#1b1928] border border-gray-700 rounded-xl px-4">
              <FileText size={19} className="text-purple-400 mt-4" />

              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={300}
                className="w-full bg-transparent py-4 outline-none resize-none"
                placeholder="Write something about yourself..."
              />
            </div>

            <p className="text-xs text-gray-500 text-right mt-2">
              {bio.length}/300 characters
            </p>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-700 hover:to-violet-800 disabled:opacity-50 rounded-xl py-4 font-semibold flex items-center justify-center gap-2 transition"
          >
            <Save size={19} />
            {saving ? "Saving..." : "Save Changes"}
          </button>

          {/* Delete Account Button */}
          <button
            type="button"
            disabled={deleting || saving}
            onClick={handleDeleteAccount}
            className="w-full mt-4 bg-red-600/10 border border-red-500/40 hover:bg-red-600/20 text-red-400 disabled:opacity-50 rounded-xl py-4 font-semibold flex items-center justify-center gap-2 transition"
          >
            <Trash2 size={19} />
            {deleting ? "Deleting..." : "Delete My Account"}
          </button>

        </form>
      </div>
    </div>
  );
}

export default Profile;
