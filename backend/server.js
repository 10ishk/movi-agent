const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// mount routes
app.use("/api/stops", require("./routes/stops"));
app.use("/api/paths", require("./routes/paths"));
app.use("/api/routes", require("./routes/transportRoutes"));
app.use("/api/vehicles", require("./routes/vehicles"));
app.use("/api/drivers", require("./routes/drivers"));
app.use("/api/daily_trips", require("./routes/dailyTrips"));
app.use("/api/deployments", require("./routes/deployments"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/image", require("./routes/image"));

app.get("/", (req, res) => res.send("Movi Backend API is running"));
app.use("/api/helpers", require("./routes/admin_helpers"));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
