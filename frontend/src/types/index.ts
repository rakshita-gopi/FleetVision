export interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone?: string;
  created_at?: string;
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  registration_number: string;
  vehicle_type: string;
  manufacturer: string;
  model: string;
  manufacturing_year: number;
  fuel_type: string;
  engine_number?: string;
  chassis_number?: string;
  purchase_date?: string;
  insurance_expiry?: string;
  fitness_expiry?: string;
  pollution_expiry?: string;
  odometer: number;
  status: string;
  created_at?: string;
}

export interface Driver {
  id: string;
  user: string;
  name: string;
  email: string;
  phone?: string;
  license_number: string;
  license_expiry: string;
  address?: string;
  emergency_contact?: string;
  blood_group?: string;
  experience_years: number;
  joining_date: string;
  status: string;
  assigned_vehicle?: string;
  assigned_vehicle_number?: string;
}

export interface Trip {
  id: string;
  vehicle: string;
  driver: string;
  vehicle_number?: string;
  driver_name?: string;
  source: string;
  destination: string;
  start_time?: string;
  end_time?: string;
  estimated_arrival?: string;
  distance: number;
  trip_status: string;
  created_at?: string;
}

export interface FuelLog {
  id: string;
  vehicle: string;
  vehicle_number?: string;
  driver?: string;
  driver_name?: string;
  fuel_station?: string;
  fuel_quantity: number;
  fuel_cost: number;
  mileage: number;
  fuel_date: string;
}

export interface MaintenanceRecord {
  id: string;
  vehicle: string;
  vehicle_number?: string;
  mechanic_name: string;
  service_type: string;
  service_date: string;
  next_service_date?: string;
  repair_cost: number;
  remarks?: string;
}

export interface Expense {
  id: string;
  vehicle: string;
  vehicle_number?: string;
  expense_category: string;
  amount: number;
  expense_date: string;
  description?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface VehicleLocation {
  id: string;
  vehicle: string;
  vehicle_number: string;
  driver?: string;
  driver_name?: string;
  vehicle_status: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  last_updated: string;
  current_trip_destination?: string;
}

export interface DashboardStats {
  total_vehicles: number;
  active_vehicles: number;
  total_drivers: number;
  trips_today: number;
  active_trips: number;
  fuel_cost_month: number;
  maintenance_cost_month: number;
  expenses_month: number;
  unread_notifications: number;
  vehicle_status_distribution: { status: string; count: number }[];
}
