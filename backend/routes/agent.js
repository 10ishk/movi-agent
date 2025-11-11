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
    const { input, currentPage, imageText } = req.body;
    const text = (input || "").trim();

    const lowered = text.toLowerCase();
    if (["yes", "y", "confirm", "proceed"].includes(lowered) && req.body.pendingId) {
      const id = req.body.pendingId;
      const p = pending[id];
      if (!p) return res.json({ ok: false, message: "No pending action found (maybe expired)" });


      if (p.action === "remove_vehicle") {
        const { trip_id, deployment_id } = p.details;

        const deleted = await deleteDeployment(deployment_id);
        const cancelled = await cancelBookings(trip_id);

        delete pending[id];

        const reply = {
          ok: true,
          message: `Removed vehicle (deployment ${deployment_id}) from trip ${trip_id}. Cancelled ${cancelled} bookings.`,
          deleted,
          cancelled
        };
        return res.json(reply);
      } else {
        return res.json({ ok: false, message: "Unknown pending action." });
      }
    }

    if (/\bremove\b.*\bvehicle\b.*\bfrom\b/i.test(text) || /\bremove vehicle\b/i.test(text)) {

      let candidate = imageText || null;
      if (!candidate) {

        const m = text.match(/from\s+(.+)$/i);
        if (m) candidate = m[1].trim();
      }

      if (!candidate) {
        return res.json({ ok: false, requiresClarification: true, message: "Which trip do you want to remove the vehicle from?" });
      }


      const trip = await findTripByText(candidate);
      if (!trip) {
        return res.json({ ok: false, message: `Couldn't find a trip matching "${candidate}".` });
      }


      const bookings = await countBookings(trip.trip_id);
      const deployment = await findDeploymentForTrip(trip.trip_id);

      if (!deployment) {
        return res.json({ ok: false, message: `No vehicle currently deployed for trip "${trip.display_name}".` });
      }


      if (bookings > 0) {
        const id = `p_${Date.now()}`;
        pending[id] = {
          action: "remove_vehicle",
          details: { trip_id: trip.trip_id, deployment_id: deployment.deployment_id },
          createdAt: Date.now()
        };

        const message = `I can remove the vehicle from "${trip.display_name}". However, this trip has ${bookings} confirmed booking(s). Removing the vehicle will cancel those bookings. Do you want to proceed? Reply with "yes" and include pendingId: ${id}`;

        return res.json({
          ok: true,
          confirmationRequired: true,
          pendingId: id,
          message,
          trip,
          bookings,
          deployment
        });
      } else {

        const deleted = await deleteDeployment(deployment.deployment_id);
        return res.json({ ok: true, message: `Vehicle removed from "${trip.display_name}" (deployment ${deployment.deployment_id}).`, deleted });
      }
    }


    if (imageText && /\bremove\b/i.test(text)) {

      const trip = await findTripByText(imageText);
      if (!trip) return res.json({ ok: false, message: "Trip not found from image text." });
      const bookings = await countBookings(trip.trip_id);
      const deployment = await findDeploymentForTrip(trip.trip_id);
      if (!deployment) return res.json({ ok: false, message: "No deployment found." });

      if (bookings > 0) {
        const id = `p_${Date.now()}`;
        pending[id] = {
          action: "remove_vehicle",
          details: { trip_id: trip.trip_id, deployment_id: deployment.deployment_id },
          createdAt: Date.now()
        };
        return res.json({
          ok: true,
          confirmationRequired: true,
          pendingId: id,
          message: `Trip "${trip.display_name}" has ${bookings} booking(s). Proceed? reply with { confirm: true, pendingId: "${id}" }`
        });
      } else {
        const deleted = await deleteDeployment(deployment.deployment_id);
        return res.json({ ok: true, message: `Vehicle removed from "${trip.display_name}".`, deleted });
      }
    }

    res.json({ ok: false, message: "I didn't understand. Try: 'Remove vehicle from Bulk - 00:01' or upload an imageText and say 'remove vehicle'." });
  } catch (err) {
    console.error("Agent error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;