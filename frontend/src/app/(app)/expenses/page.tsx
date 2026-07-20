"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { FormPanel, Field } from "@/components/shared/form-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api, { ApiResponse } from "@/lib/api";
import { Expense, Vehicle } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

const COLORS = ["#2563eb", "#0891b2", "#16a34a", "#d97706", "#7c3aed", "#dc2626"];
const CATEGORIES = ["Fuel", "Maintenance", "Insurance", "Toll", "Parking", "Driver Allowance", "Miscellaneous"];

const emptyForm = {
  vehicle: "",
  expense_category: "Miscellaneous",
  amount: 0,
  expense_date: new Date().toISOString().slice(0, 10),
  description: "",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    try {
      const [eRes, vRes] = await Promise.all([
        api.get<ApiResponse<Expense[]>>("/expenses/"),
        api.get<ApiResponse<Vehicle[]>>("/vehicles/"),
      ]);
      setExpenses(eRes.data.data || []);
      setVehicles(vRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setForm({
      vehicle: exp.vehicle || "",
      expense_category: exp.expense_category || "Miscellaneous",
      amount: Number(exp.amount),
      expense_date: exp.expense_date || "",
      description: exp.description || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.vehicle) {
      toast.error("Vehicle is required");
      return;
    }
    const payload = { ...form, amount: Number(form.amount) };
    try {
      if (editingId) {
        await api.patch(`/expenses/${editingId}/`, payload);
        toast.success("Expense updated");
      } else {
        await api.post("/expenses/", payload);
        toast.success("Expense added");
      }
      setShowForm(false);
      setEditingId(null);
      await fetchAll();
    } catch {
      toast.error("Failed to save expense");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await api.delete(`/expenses/${id}/`);
      toast.success("Expense deleted");
      await fetchAll();
    } catch {
      toast.error("Failed to delete expense");
    }
  };

  const byCategory = Object.entries(
    expenses.reduce((acc, e) => {
      acc[e.expense_category] = (acc[e.expense_category] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  return (
    <>
      <TopNav title="Expenses" subtitle="Operational cost management" />
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-[var(--muted)]">{expenses.length} expense records</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        </div>

        {showForm && (
          <FormPanel
            title={editingId ? "Edit Expense" : "Add Expense"}
            onSubmit={handleSave}
            onCancel={() => { setShowForm(false); setEditingId(null); }}
            submitLabel={editingId ? "Update" : "Save"}
          >
            <Field label="Vehicle">
              <Select value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })}>
                <option value="">Select vehicle</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
              </Select>
            </Field>
            <Field label="Category">
              <Select value={form.expense_category} onChange={(e) => setForm({ ...form, expense_category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Amount">
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </FormPanel>
        )}

        <Card>
          <CardHeader><CardTitle>Expenses by Category</CardTitle></CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <DataTable
          loading={loading}
          data={expenses as unknown as Record<string, unknown>[]}
          columns={[
            { key: "vehicle_number", label: "Vehicle" },
            { key: "expense_category", label: "Category" },
            { key: "amount", label: "Amount", render: (row) => formatCurrency(Number(row.amount)) },
            { key: "expense_date", label: "Date", render: (row) => formatDate(row.expense_date as string) },
            { key: "description", label: "Description" },
          ]}
          actions={(row) => (
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={() => openEdit(row as unknown as Expense)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id as string)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        />
      </div>
    </>
  );
}
