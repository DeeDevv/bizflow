"use client";

import { useState } from "react";
import { Mail, Pencil, Plus, UserRoundPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EMPLOYEE_ROLES, roleLabel } from "@/lib/employee-roles";
import { useSetup, type Employee } from "@/lib/setup-store";
import { StepError, field } from "./shared";

/**
 * Step 3 — Team. The owner adds the people who will operate BizMate day to
 * day. Employees are local mock records for now (no backend yet): "active"
 * means created directly, "pending" means the invitation UI state only.
 */

interface EmployeeDraft {
  name: string;
  contact: string;
  role: string;
}

function emptyDraft(): EmployeeDraft {
  return { name: "", contact: "", role: "cashier" };
}

export function TeamStep({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  const { setup, addEmployee, updateEmployee, removeEmployee } = useSetup();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [draft, setDraft] = useState<EmployeeDraft>(emptyDraft());
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setDraft(emptyDraft());
    setShowForm(true);
    setError(null);
  }

  function openEdit(employee: Employee) {
    setEditing(employee);
    setDraft({ name: employee.name, contact: employee.contact, role: employee.role });
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setDraft(emptyDraft());
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setError("Please enter the employee's name.");
      return;
    }
    if (!draft.role) {
      setError("Please choose a role.");
      return;
    }
    const payload = {
      name,
      contact: draft.contact.trim(),
      role: draft.role as Employee["role"],
    };
    if (editing) {
      updateEmployee(editing.id, { ...payload, status: editing.status });
    } else {
      // A contact turns this into a mock "invitation pending" record —
      // real invitations arrive with the backend.
      addEmployee({ ...payload, status: draft.contact.trim() ? "pending" : "active" });
    }
    closeForm();
  }

  function handleRemove(employee: Employee) {
    removeEmployee(employee.id);
    if (editing?.id === employee.id) closeForm();
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
        Add your team
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        These are the people who will record sales and handle daily work. You
        can also do this later — BizMate works without employees for now.
      </p>

      {/* Empty state */}
      {setup.employees.length === 0 && !showForm ? (
        <div className="mt-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
          <Users aria-hidden className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm font-medium text-zinc-900">No employees yet</p>
          <p className="mt-0.5 text-sm text-zinc-500">Your employees will appear here.</p>
          <div className="mt-4">
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <UserRoundPlus aria-hidden className="h-4 w-4" />
              Add Employee
            </Button>
          </div>
        </div>
      ) : null}

      {/* Employee list */}
      {setup.employees.length > 0 ? (
        <ul className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {setup.employees.map((employee) => (
            <li key={employee.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {employee.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-zinc-900">
                  <span className="truncate">{employee.name}</span>
                  {employee.status === "pending" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <Mail aria-hidden className="h-3 w-3" />
                      Invitation pending
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {roleLabel(employee.role)}
                  {employee.contact ? ` · ${employee.contact}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(employee)}
                aria-label={`Edit ${employee.name}`}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <Pencil aria-hidden className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(employee)}
                aria-label={`Remove ${employee.name}`}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Add / edit form */}
      {showForm ? (
        <form
          onSubmit={handleSave}
          noValidate
          className="mt-4 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="emp-name" className="text-sm font-medium text-zinc-700">
                Employee name <span aria-hidden className="text-red-500">*</span>
              </label>
              <input
                id="emp-name"
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Grace Adeyemi"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="emp-contact" className="text-sm font-medium text-zinc-700">
                Phone or email <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                id="emp-contact"
                type="text"
                value={draft.contact}
                onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
                placeholder="Phone number or email"
                className={field}
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                Adding one queues a mock invite — real invitations come later.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="emp-role" className="text-sm font-medium text-zinc-700">
              Role <span aria-hidden className="text-red-500">*</span>
            </label>
            <select
              id="emp-role"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              className={field}
            >
              {EMPLOYEE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.description}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-zinc-400">
              Each role sees only the tools it needs — permissions come with it.
            </p>
          </div>

          {error ? <StepError message={error} /> : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save Changes" : "Add Employee"}</Button>
          </div>
        </form>
      ) : (
        <div className="mt-4">
          <Button size="sm" variant="secondary" onClick={openAdd} className="gap-1.5">
            <Plus aria-hidden className="h-4 w-4" />
            Add Employee
          </Button>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          {setup.employees.length === 0 ? (
            <span className="hidden text-xs text-zinc-400 sm:inline">
              I&apos;ll do this later
            </span>
          ) : null}
          <Button onClick={onNext}>Continue</Button>
        </div>
      </div>
    </Card>
  );
}
