const express = require("express");
const axios = require("axios");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function baseUrl() {
  return process.env.ZARINPAL_SANDBOX === "true"
    ? "https://sandbox.zarinpal.com/pg/v4/payment"
    : "https://payment.zarinpal.com/pg/v4/payment";
}
function startPayUrl(authority) {
  const host = process.env.ZARINPAL_SANDBOX === "true"
    ? "https://sandbox.zarinpal.com/pg/StartPay/"
    : "https://payment.zarinpal.com/pg/StartPay/";
  return host + authority;
}

// Create a Zarinpal payment request from everything currently in the user's cart.
router.post("/request", requireAuth, async (req, res) => {
  try {
    const cartResult = await pool.query(
      `SELECT c.id as clip_id, c.title, c.price FROM cart_items ci
       JOIN clips c ON c.id = ci.clip_id WHERE ci.user_id=$1`,
      [req.user.id]
    );
    const items = cartResult.rows;
    if (items.length === 0) return res.status(400).json({ error: "سبد خرید خالی است" });

    const amount = items.reduce((sum, it) => sum + it.price, 0);
    if (amount <= 0) return res.status(400).json({ error: "مبلغ قابل پرداخت صفر است" });

    const orderResult = await pool.query(
      "INSERT INTO orders (user_id, amount, status) VALUES ($1,$2,'pending') RETURNING id",
      [req.user.id, amount]
    );
    const orderId = orderResult.rows[0].id;
    for (const it of items) {
      await pool.query(
        "INSERT INTO order_items (order_id, clip_id, price) VALUES ($1,$2,$3)",
        [orderId, it.clip_id, it.price]
      );
    }

    const zpRes = await axios.post(`${baseUrl()}/request.json`, {
      merchant_id: process.env.ZARINPAL_MERCHANT_ID,
      currency: "IRT",
      amount,
      description: `خرید ${items.length} کلیپ آموزشی فیزیک‌یار`,
      callback_url: `${process.env.ZARINPAL_CALLBACK_URL}?orderId=${orderId}`
    });

    const data = zpRes.data && zpRes.data.data;
    if (!data || data.code !== 100) {
      return res.status(502).json({ error: "درگاه پرداخت پاسخ نداد", details: zpRes.data });
    }

    await pool.query("UPDATE orders SET authority=$1 WHERE id=$2", [data.authority, orderId]);
    res.json({ paymentUrl: startPayUrl(data.authority) });
  } catch (err) {
    console.error(err.response ? err.response.data : err);
    res.status(500).json({ error: "خطا در ایجاد درخواست پرداخت" });
  }
});

// Zarinpal redirects the browser here after payment (success or cancel).
router.get("/verify", async (req, res) => {
  const { Authority, Status, orderId } = req.query;
  try {
    const orderResult = await pool.query("SELECT * FROM orders WHERE id=$1", [orderId]);
    if (orderResult.rowCount === 0) return res.status(404).send("سفارش پیدا نشد");
    const order = orderResult.rows[0];

    if (Status !== "OK") {
      await pool.query("UPDATE orders SET status='failed' WHERE id=$1", [order.id]);
      return res.redirect(`${process.env.CORS_ORIGIN}/?payment=cancelled`);
    }

    const zpRes = await axios.post(`${baseUrl()}/verify.json`, {
      merchant_id: process.env.ZARINPAL_MERCHANT_ID,
      amount: order.amount,
      authority: Authority
    });
    const data = zpRes.data && zpRes.data.data;

    if (data && (data.code === 100 || data.code === 101)) {
      await pool.query("UPDATE orders SET status='paid', ref_id=$1 WHERE id=$2", [String(data.ref_id || ""), order.id]);
      const items = await pool.query("SELECT clip_id, price FROM order_items WHERE order_id=$1", [order.id]);
      for (const it of items.rows) {
        await pool.query(
          `INSERT INTO purchases (user_id, clip_id, price_paid) VALUES ($1,$2,$3)
           ON CONFLICT (user_id, clip_id) DO NOTHING`,
          [order.user_id, it.clip_id, it.price]
        );
        await pool.query("DELETE FROM cart_items WHERE user_id=$1 AND clip_id=$2", [order.user_id, it.clip_id]);
      }
      return res.redirect(`${process.env.CORS_ORIGIN}/?payment=success`);
    }

    await pool.query("UPDATE orders SET status='failed' WHERE id=$1", [order.id]);
    return res.redirect(`${process.env.CORS_ORIGIN}/?payment=failed`);
  } catch (err) {
    console.error(err.response ? err.response.data : err);
    return res.redirect(`${process.env.CORS_ORIGIN}/?payment=error`);
  }
});

module.exports = router;
