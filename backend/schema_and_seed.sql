BEGIN TRANSACTION;

-- Stops
CREATE TABLE stops (
  stop_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  latitude REAL,
  longitude REAL
);

-- Paths (ordered list via path_stops)
CREATE TABLE paths (
  path_id INTEGER PRIMARY KEY AUTOINCREMENT,
  path_name TEXT NOT NULL
);

CREATE TABLE path_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path_id INTEGER NOT NULL,
  stop_id INTEGER NOT NULL,
  stop_order INTEGER NOT NULL,
  FOREIGN KEY(path_id) REFERENCES paths(path_id),
  FOREIGN KEY(stop_id) REFERENCES stops(stop_id)
);

-- Routes (Path + Time)
CREATE TABLE routes (
  route_id INTEGER PRIMARY KEY AUTOINCREMENT,
  path_id INTEGER NOT NULL,
  route_display_name TEXT NOT NULL,
  shift_time TEXT NOT NULL,
  direction TEXT,
  start_point TEXT,
  end_point TEXT,
  status TEXT CHECK(status IN ('active','deactivated')) DEFAULT 'active',
  FOREIGN KEY(path_id) REFERENCES paths(path_id)
);

-- Vehicles
CREATE TABLE vehicles (
  vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_plate TEXT NOT NULL UNIQUE,
  type TEXT,
  capacity INTEGER
);

-- Drivers
CREATE TABLE drivers (
  driver_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone_number TEXT
);

-- DailyTrips
CREATE TABLE daily_trips (
  trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  booking_status_percentage REAL DEFAULT 0,
  live_status TEXT,
  scheduled_date TEXT,
  FOREIGN KEY(route_id) REFERENCES routes(route_id)
);

-- Deployments (assignment vehicle+driver -> trip)
CREATE TABLE deployments (
  deployment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  vehicle_id INTEGER,
  driver_id INTEGER,
  FOREIGN KEY(trip_id) REFERENCES daily_trips(trip_id),
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(vehicle_id),
  FOREIGN KEY(driver_id) REFERENCES drivers(driver_id)
);

-- Bookings (to compute booking % and detect consequences)
CREATE TABLE bookings (
  booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  passenger_name TEXT,
  status TEXT CHECK(status IN ('confirmed','cancelled')) DEFAULT 'confirmed',
  FOREIGN KEY(trip_id) REFERENCES daily_trips(trip_id)
);

-- Sample data
INSERT INTO stops(name, latitude, longitude) VALUES
('Gavipuram', 12.9716, 77.5946),
('Temple', 12.9750, 77.5900),
('Peenya', 13.0140, 77.5600),
('Odeon Circle', 12.9800, 77.6000),
('Tech Park', 12.9900, 77.6000);

INSERT INTO paths(path_name) VALUES ('Path-1'), ('Path-2'), ('Tech-Loop');

INSERT INTO path_stops(path_id, stop_id, stop_order) VALUES
(1,1,1), (1,2,2), (1,3,3),
(2,3,2), (2,1,1), (2,4,3),
(3,1,1), (3,5,2), (3,3,3);

INSERT INTO routes(path_id, route_display_name, shift_time, direction, start_point, end_point, status) VALUES
(1, 'Path-1 - 07:30', '07:30', 'UP', 'Gavipuram', 'Peenya', 'active'),
(2, 'Path-2 - 19:45', '19:45', 'DOWN', 'Peenya', 'Odeon Circle', 'active'),
(3, 'Tech-Loop - 09:00', '09:00', 'UP', 'Gavipuram', 'Tech Park', 'active');

INSERT INTO vehicles(license_plate, type, capacity) VALUES
('KA-01-AB-1234','Bus',40),
('KA-12-CD-3456','Bus',40),
('KA-05-EF-9876','Cab',4);

INSERT INTO drivers(name, phone_number) VALUES
('Amit','+91-9000000001'),
('Suresh','+91-9000000002'),
('Priya','+91-9000000003');

INSERT INTO daily_trips(route_id, display_name, booking_status_percentage, live_status, scheduled_date) VALUES
(1, 'Bulk - 00:01', 25.0, '00:01 IN', date('now')),
(2, 'Path - 00:02', 0.0, '00:02 SCHEDULED', date('now')),
(3, 'TechLoop - 09:00', 60.0, '09:00 SCHEDULED', date('now'));

INSERT INTO deployments(trip_id, vehicle_id, driver_id) VALUES
(1, 1, 1),
(2, 2, 2);

INSERT INTO bookings(trip_id, passenger_name, status) VALUES
(1,'Employee1','confirmed'),(1,'Employee2','confirmed'),(1,'Employee3','confirmed'),(1,'Employee4','confirmed'),
(1,'Employee5','confirmed'),(1,'Employee6','confirmed'),(1,'Employee7','confirmed'),(1,'Employee8','confirmed'),
(1,'Employee9','confirmed'),(1,'Employee10','confirmed');

COMMIT;
