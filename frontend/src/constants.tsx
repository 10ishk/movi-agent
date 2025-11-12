import type { Trip, Route } from './types.ts';

export const MOCK_TRIPS: Trip[] = [
  { id: 'trip-1', name: 'Bulk - 00:01', type: 'Bulk', time: '00:01 IN', status: 'ON TIME', progress: 0, duration: '23:12 - 00:01', capacity: 'N/A', stops: { E: 0, O: 0, V: 0, VOL: 0 } },
  { id: 'trip-2', name: 'Path Path - 00:02', type: 'Path Path', time: '00:02 IN', status: 'ON TIME', progress: 0 },
  { id: 'trip-3', name: 'Path Path - 00:10', type: 'Path Path', time: '00:10 IN (bn)', status: 'DELAYED', progress: 0 },
  { id: 'trip-4', name: 'Groone - 00:59', type: 'Groone', time: '00:59 OUT', status: 'ON TIME', progress: 0 },
  { id: 'trip-5', name: 'AVX - 05:15', type: 'AVX', time: '05:15 IN', status: 'ON TIME', progress: 0 },
  { id: 'trip-6', name: 'NoShow - BTS - 13:00', type: 'NoShow', time: '13:00 OUT', status: 'ON TIME', progress: 50 },
  { id: 'trip-7', name: 'Bulk - 00:03', type: 'Bulk', time: '00:03 IN', status: 'ON TIME', progress: 25 },
  { id: 'trip-8', name: 'Path Path - 00:05', type: 'Path Path', time: '00:05 IN', status: 'ON TIME', progress: 10 },
];

export const MOCK_ROUTES: Route[] = [
  { id: 76918, name: 'Path2 - 19:45', direction: 'LOGIN', shiftTime: '19:45', startPoint: 'Gavipuram', endPoint: 'peenya', capacity: 0, allowedWaitlist: true, someOtherCheck: false },
  { id: 76919, name: 'Path2 - 22:00', direction: 'LOGIN', shiftTime: '23:00', startPoint: 'Gavipuram', endPoint: 'peenya', capacity: 0, allowedWaitlist: true, someOtherCheck: false },
  { id: 76917, name: 'Path2 - 20:00', direction: 'LOGIN', shiftTime: '20:00', startPoint: 'Gavipuram', endPoint: 'peenya', capacity: 0, allowedWaitlist: true, someOtherCheck: false },
  { id: 76920, name: 'Path2 - 19:00', direction: 'LOGIN', shiftTime: '19:00 (KS)', startPoint: 'Gavipuram', endPoint: 'peenya', capacity: 0, allowedWaitlist: true, someOtherCheck: false },
  { id: 76914, name: 'Path1 - 21:00', direction: 'LOGIN', shiftTime: '21:00', startPoint: 'Gavipuram', endPoint: 'Temple', capacity: 0, allowedWaitlist: true, someOtherCheck: false },
  { id: 76913, name: 'Path1 - 20:00', direction: 'LOGIN', shiftTime: '20:00', startPoint: 'Gavipuram', endPoint: 'Temple', capacity: 0, allowedWaitlist: true, someOtherCheck: false },
  { id: 76916, name: 'Path1 - 22:00', direction: 'LOGIN', shiftTime: '23:00', startPoint: 'Gavipuram', endPoint: 'Temple', capacity: 0, allowedWaitlist: true, someOtherCheck: false },
  { id: 76915, name: 'Path1 - 22:00', direction: 'LOGIN', shiftTime: '22:00', startPoint: 'Gavipuram', endPoint: 'Temple', capacity: 0, allowedWaitlist: true, someOtherCheck: false },
  { id: 76234, name: 'paradise - 05:00', direction: 'LOGIN', shiftTime: '05:00', startPoint: 'BTM', endPoint: 'NoShow', capacity: 6, allowedWaitlist: false, someOtherCheck: false },
  { id: 76912, name: 'Dice', direction: 'LOGIN', shiftTime: '18:00', startPoint: 'BTM', endPoint: 'NoShow', capacity: 0, allowedWaitlist: true, someOtherCheck: false },
];