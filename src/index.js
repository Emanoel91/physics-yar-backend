require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const catalogRoutes = require("./routes/catalog");
const cartRoutes = require("./routes/cart");
const paymentRoutes = require("./routes/payment");
const adminRoutes = require("./routes/admin");

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api", catalogRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`physics-yar backend listening on port ${port}`));
