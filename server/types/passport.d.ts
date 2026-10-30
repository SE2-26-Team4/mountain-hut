export {};

declare global {
  namespace Express {
    interface User {
      id: number;
      full_name: string;
      email: string;
      role: 'hiker' | 'employee' | 'warden';
    }
  }
}