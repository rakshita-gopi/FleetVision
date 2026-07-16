"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api, { ApiResponse } from "@/lib/api";
import { Expense } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const COLORS = ["#2563eb", "#0891b2", "#16a34a", "#d97706", "#7c3aed", "#dc2626"];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<Expense[]>>("/expenses/").then((res) => {
      setExpenses(res.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

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
        />
      </div>
    </>
  );
}
