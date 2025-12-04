const express = require("express");
const db = require("../db");
const router = express.Router();

const pending = {}; 

function findTripByText(text) {
  return new Promise((resolve, reject) => {
    const q = `SELECT trip_id, display_name FROM daily_trips WHERE display_name LIKE ? LIMIT 1`;
    db.get(q, [`%${text}%`], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function countBookings(trip_id) {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) AS cnt FROM bookings WHERE trip_id = ? AND status = 'confirmed'", [trip_id], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.cnt : 0);
    });
  });
}

function findDeploymentForTrip(trip_id) {
  return new Promise((resolve, reject) => {
    db.get("SELECT deployment_id, vehicle_id, driver_id FROM deployments WHERE trip_id = ? LIMIT 1", [trip_id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function cancelBookings(trip_id) {
  return new Promise((resolve, reject) => {
    db.run("UPDATE bookings SET status='cancelled' WHERE trip_id = ? AND status='confirmed'", [trip_id], function (err) {
      if (err) return reject(err);
      resolve(this.changes || 0);
    });
  });
}

function deleteDeployment(deployment_id) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM deployments WHERE deployment_id = ?", [deployment_id], function (err) {
      if (err) return reject(err);
      resolve(this.changes || 0);
    });
  });
}

router.post("/", async (req, res) => {
  try {
    const { input, currentPage, imageText, pendingId: bodyPendingId } = req.body;
    const text = (input || "").trim();
    const lowered = text.toLowerCase();

    // 1) Handle confirm / yes for pending actions
    if (["yes", "y", "confirm", "proceed"].includes(lowered) && bodyPendingId) {
      const p = pending[bodyPendingId];
      if (!p) {
        return res.json({
          ok: false,
          message: "No pending action found (maybe already completed or expired).",
        });
      }

      if (p.action === "remove_vehicle") {
        const { trip_id, deployment_id } = p.details;

        const deleted = await deleteDeployment(deployment_id);
        const cancelled = await cancelBookings(trip_id);

        delete pending[bodyPendingId];

        const reply = {
          ok: true,
          message: `Removed vehicle (deployment ${deployment_id}) from trip ${trip_id}. Cancelled ${cancelled} bookings.`,
          deleted,
          cancelled,
        };
        return res.json(reply);
      }

      return res.json({ ok: false, message: "Unknown pending action." });
    }

    // Helper to extract trip text
    function extractTripCandidateForStatus() {
      if (imageText && imageText.trim()) {
        return imageText.trim();
      }

      // "what is the status of X" or "status of X"
      const m = text.match(
        /(?:what\s+is\s+the\s+status\s+of|what\s+is\s+status\s+of|status\s+of|status)\s+(.+)$/i
      );
      if (m) return m[1].trim();

      // Bare trip name like "Bulk - 00:03" or "NoShow - BTS - 13:00"
      if (/[-:]/.test(text)) {
        return text.trim();
      }

      return null;
    }

    async function replyWithTripStatus(candidate) {
      const trip = await findTripByText(candidate);
      if (!trip) {
        return res.json({
          ok: false,
          message: `I couldn't find a trip matching "${candidate}". Try clicking it in the UI or check the exact display name.`,
        });
      }

      const bookings = await countBookings(trip.trip_id);
      const deployment = await findDeploymentForTrip(trip.trip_id);

      let vehiclePart = "currently has no vehicle assigned.";
      if (deployment && deployment.vehicle_id) {
        vehiclePart = `has vehicle ${deployment.vehicle_id} assigned.`;
      }

      const message = `Trip '${trip.display_name}' (id ${trip.trip_id}) on today has ${bookings} booking(s) and ${vehiclePart}`;

      return res.json({
        ok: true,
        intent: "status",
        trip,
        bookings,
        deployment,
        message,
      });
    }

    // 2) Status intent ("status of X", "what is the status of X", or just a trip-like string)
    const looksLikeStatus =
      /\bstatus\b/.test(lowered) ||
      // Heuristic: if the user is on a trips page and just types a name
      (currentPage === "trips" && /[-:]/.test(text));

    if (looksLikeStatus || (!/\bremove\b/.test(lowered) && /[-:]/.test(text))) {
      const candidate = extractTripCandidateForStatus();
      if (!candidate) {
        return res.json({
          ok: false,
          requiresClarification: true,
          message: "Which trip do you want the status of?",
        });
      }

      return await replyWithTripStatus(candidate);
    }

    // 3) Remove vehicle intent: "remove vehicle from X" or "remove vehicle"
    if (/\bremove\b.*\bvehicle\b.*\bfrom\b/i.test(text) || /\bremove vehicle\b/i.test(text)) {
      let candidate = imageText || null;
      if (!candidate) {
        const m = text.match(/from\s+(.+)$/i);
        if (m) candidate = m[1].trim();
      }

      if (!candidate) {
        return res.json({
          ok: false,
          requiresClarification: true,
          message: "Which trip do you want to remove the vehicle from?",
        });
      }

      const trip = await findTripByText(candidate);
      if (!trip) {
        return res.json({
          ok: false,
          message: `Couldn't find a trip matching "${candidate}".`,
        });
      }

      const bookings = await countBookings(trip.trip_id);
      const deployment = await findDeploymentForTrip(trip.trip_id);

      if (!deployment) {
        return res.json({
          ok: false,
          message: `No vehicle currently deployed for trip "${trip.display_name}".`,
        });
      }

      if (bookings > 0) {
        const id = `p_${Date.now()}`;
        pending[id] = {
          action: "remove_vehicle",
          details: { trip_id: trip.trip_id, deployment_id: deployment.deployment_id },
          createdAt: Date.now(),
        };

        const message = `I can remove the vehicle from "${trip.display_name}". However, this trip has ${bookings} confirmed booking(s). Removing the vehicle will cancel those bookings. Do you want to proceed? Reply with "yes" and include pendingId: ${id}`;

        return res.json({
          ok: true,
          confirmationRequired: true,
          pendingId: id,
          message,
          trip,
          bookings,
          deployment,
        });
      } else {
        const deleted = await deleteDeployment(deployment.deployment_id);
        return res.json({
          ok: true,
          message: `Vehicle removed from "${trip.display_name}" (deployment ${deployment.deployment_id}).`,
          deleted,
        });
      }
    }

    // 4) Fallback
    return res.json({
      ok: false,
      message:
        "I didn't understand. Try: 'status of Bulk - 00:01', 'Remove vehicle from Bulk - 00:01', or click a trip in the UI and then ask.",
    });
  } catch (err) {
    console.error("Agent error:", err);
    return res.status(500).json({ error: err.message });
  }
});


module.exports = router;