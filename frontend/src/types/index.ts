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

/** Phase 2 Redis-backed live telemetry state */
export interface LiveVehicleState {
  vehicle_id: string;
  equipment_id?: string;
  asset_id?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  fuel_level?: number;
  rpm?: number;
  engine_temperature?: number;
  battery_voltage?: number;
  odometer?: number;
  gps_accuracy?: number;
  source?: string;
  last_updated: string;
  vehicle_number?: string;
}

export interface TelemetryPoint {
  time: string;
  event_id: string;
  vehicle_id: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  fuel_level?: number;
  engine_temperature?: number;
  rpm?: number;
  battery_voltage?: number;
  source?: string;
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

export interface Equipment {
  id: string;
  asset_id: string;
  serial_number?: string;
  manufacture_year?: number;
  acquisition_type?: string;
  current_status: string;
  total_engine_hours: number;
  model_name?: string;
  category?: string;
  manufacturer?: string;
  site_id?: string | null;
  site_name?: string | null;
  operator_id?: string | null;
  operator_name?: string | null;
  live?: LiveVehicleState | null;
}

export interface Site {
  id: string;
  site_id: string;
  site_name: string;
  site_type?: string;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
}

export interface Operator {
  id: string;
  operator_id: string;
  name: string;
  certification?: string;
  experience_years: number;
  shift?: string;
  status: string;
}

export interface Rental {
  id: string;
  rental_id: string;
  transaction_id?: string | null;
  equipment: string;
  asset_id?: string;
  equipment_category?: string;
  site?: string | null;
  site_id?: string | null;
  site_name?: string | null;
  operator?: string | null;
  operator_id?: string | null;
  operator_name?: string | null;
  customer_id?: string;
  customer_name?: string;
  check_out_date?: string | null;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  check_out_at?: string | null;
  check_in_at?: string | null;
  rental_days: number;
  daily_rate: number;
  rental_status: string;
  invoice_number?: string;
  qr_expired?: boolean;
}

export interface RentalDashboard {
  total: number;
  available: number;
  active: number;
  idle: number;
  maintenance: number;
  overdue_rentals: number;
  underutilised: number;
  active_rentals: number;
  utilisation_pct?: number;
  live_assets?: number;
  returns?: {
    id: string;
    rental_id: string;
    asset_id: string;
    site_id?: string | null;
    expected_return_date?: string | null;
    days_until?: number | null;
    overdue?: boolean;
  }[];
}

export interface ActionProposal {
  id: string;
  action_type: string;
  asset_id?: string | null;
  rental_id?: string | null;
  rationale: string;
  payload?: Record<string, unknown>;
  status: string;
  created_at: string;
  execution_result?: string;
}

