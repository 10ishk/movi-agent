
export interface Trip {
  id: string;
  name: string;
  type: 'Bulk' | 'Path Path' | 'Groone' | 'AVX' | 'NoShow';
  time: string;
  status: 'IN' | 'OUT' | 'DELAYED' | 'ON TIME';
  progress: number;
  duration?: string;
  capacity?: string;
  stops?: { E: number; O: number; V: number; VOL: number };
}

export interface Route {
  id: number;
  name: string;
  direction: 'LOGIN' | 'LOGOUT';
  shiftTime: string;
  startPoint: string;
  endPoint: string;
  capacity: number;
  allowedWaitlist: boolean;
  someOtherCheck: boolean;
}

export interface ChatMessage {
  id: number;
  sender: 'user' | 'agent';
  text: string;
  imageText?: string;
}
