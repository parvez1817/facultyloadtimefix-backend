// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// --------------------
// ✅ CORS CONFIGURATION
// --------------------
app.use(cors({ 
  origin: [ 
    "http://localhost:5173",                   // local dev frontend (Vite) 
    "http://localhost:8080",                   // local dev frontend port 8080
    "https://sonafaculty-idcard-portal.netlify.app" // deployed frontend (no trailing slash)
  ],
  methods: ["GET", "POST", "PATCH", "DELETE"],
}));

// --------------------
// ✅ EXPRESS MIDDLEWARE
// --------------------
app.use(express.json());

// --------------------
// ✅ MONGODB CONNECTION
// --------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // fail fast if DB not reachable
  socketTimeoutMS: 45000,         // avoid hung sockets
  maxPoolSize: 10,                // reasonable pool size
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

// --------------------
// ✅ MODELS
// --------------------
const idCardSchema = new mongoose.Schema({}, { strict: false });
const IdCard = mongoose.model("IdCard", idCardSchema, "idcards");
const RejectedIdCard = mongoose.model("RejectedIdCard", idCardSchema, "rejectedidcards");
const PrintId = mongoose.model("PrintId", idCardSchema, "printids");

const facultySchema = new mongoose.Schema({
  facNumber: { type: String, required: true, unique: true }
});
facultySchema.index({ facNumber: 1 }, { unique: true });
const FacultyNumber = mongoose.model("FacultyNumber", facultySchema, "facultynumbers");
FacultyNumber.createIndexes().catch((e) => console.warn("⚠️ Failed to create indexes for FacultyNumber:", e.message));

const accHistorySchema = new mongoose.Schema({}, { strict: false });
const AccHistoryId = mongoose.model("AccHistoryId", accHistorySchema, "acchistoryids");

const rejHistorySchema = new mongoose.Schema({}, { strict: false });
const RejHistoryId = mongoose.model("RejHistoryId", rejHistorySchema, "rejhistoryids");

// --------------------
// ✅ PATCH: Approve/Reject Requests
// --------------------
app.patch("/api/requests/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const request = await IdCard.findById(id);
    if (!request) return res.status(404).send({ message: "Request not found" });

    if (status === "approved") {
      const printReq = new PrintId(request.toObject());
      await printReq.save();
    } else if (status === "rejected") {
      const rejectedReq = new RejectedIdCard(request.toObject());
      await rejectedReq.save();
    }

    await IdCard.findByIdAndDelete(id);
    res.send({ message: `Request ${status} successfully` });
  } catch (error) {
    console.error("❌ Error updating request:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// --------------------
// ✅ GET APIs
// --------------------
app.get("/api/pending", async (req, res) => {
  try {
    const data = await IdCard.find().lean();
    res.json(data);
  } catch (error) {
    console.error("❌ Error fetching pending requests:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/api/approved", async (req, res) => {
  try {
    const data = await PrintId.find().lean();
    res.json(data);
  } catch (error) {
    console.error("❌ Error fetching approved requests:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/api/rejected", async (req, res) => {
  try {
    const data = await RejectedIdCard.find().lean();
    res.json(data);
  } catch (error) {
    console.error("❌ Error fetching rejected requests:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// --------------------
// ✅ CHECK FACULTY ID
// --------------------
app.get("/api/check-faculty/:id", async (req, res) => {
  try {
    const facultyId = req.params.id;
    const exists = await FacultyNumber.exists({ facNumber: facultyId }).maxTimeMS(1000);
    res.json({ valid: !!exists });
  } catch (error) {
    console.error("❌ Error checking faculty ID:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// --------------------
// ✅ HISTORY APIs
// --------------------
app.get("/api/acchistoryids", async (req, res) => {
  try {
    const data = await AccHistoryId.find().lean();
    res.json(data);
  } catch (error) {
    console.error("❌ Error fetching approved history data:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/api/rejhistoryids", async (req, res) => {
  try {
    const data = await RejHistoryId.find().lean();
    res.json(data);
  } catch (error) {
    console.error("❌ Error fetching rejected history data:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// --------------------
// ✅ HEALTH CHECK
// --------------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "ReIDentify Backend API is running",
    timestamp: new Date().toISOString()
  });
});

// --------------------
// ✅ START SERVER
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 ReIDentify Backend Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/api/health`);
});
