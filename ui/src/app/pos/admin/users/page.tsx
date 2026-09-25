"use client";
import { useState } from "react";
import { useAdminUsers, useDeleteUserMutation, useCreateUserMutation } from "@/lib/queries";
import { usePosStore } from "@/lib/store";

export default function AdminUsersPage() {
  const { data: users, isLoading } = useAdminUsers();
  const deleteMutation = useDeleteUserMutation();
  const createMutation = useCreateUserMutation();
  const currentUser = usePosStore(s => s.user);

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "STAFF" });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData, {
      onSuccess: () => {
        setIsCreating(false);
        setFormData({ name: "", email: "", password: "", role: "STAFF" });
      }
    });
  };

  const ROLE_COLOR: Record<string, string> = {
    ADMIN: "var(--accent)", STAFF: "#3b82f6", KITCHEN: "#f59e0b",
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-y-auto scrollable p-6 md:p-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-up">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">User Management</h1>
          <p className="text-muted font-mono text-xs tracking-widest uppercase">Staff Accounts & Roles</p>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-accent hover:bg-accent/90 text-black px-6 py-3 rounded-xl font-mono text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-sm"
        >
          {isCreating ? "CANCEL" : "+ ADD USER"}
        </button>
      </div>

      {isCreating && (
        <div className="p-6 rounded-3xl bg-surface-1 border border-border shadow-sm fade-up flex flex-col gap-4 max-w-xl">
          <h3 className="font-mono text-xs font-bold tracking-widest text-muted">CREATE NEW USER</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] text-muted mb-1">NAME</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2 font-bold" />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-muted mb-1">EMAIL</label>
              <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2 font-bold" />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-muted mb-1">PASSWORD</label>
              <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2 font-bold" />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-muted mb-1">ROLE</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2 font-bold">
                <option value="STAFF">STAFF</option>
                <option value="KITCHEN">KITCHEN</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <button disabled={createMutation.isPending} type="submit" className="w-full bg-accent text-black font-mono font-bold py-3 rounded-xl mt-4 disabled:opacity-50">
              {createMutation.isPending ? "CREATING..." : "CREATE USER"}
            </button>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 fade-up" style={{ animationDelay: "100ms" }}>
        {users?.map(u => (
          <div key={u.id} className="p-6 rounded-2xl bg-surface-1 border border-border shadow-sm flex flex-col gap-4 relative group">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{u.name}</h3>
                <p className="font-mono text-xs text-muted">{u.email}</p>
              </div>
              <span className="font-mono text-[10px] font-bold px-3 py-1 rounded-full" style={{ color: ROLE_COLOR[u.role] || "#fff", backgroundColor: `${ROLE_COLOR[u.role]}22` }}>
                {u.role}
              </span>
            </div>
            
            <div className="pt-4 mt-auto border-t border-border/50 flex justify-end">
              {u.id !== currentUser?.id && (
                <button 
                  onClick={() => {
                    if (confirm(`Are you sure you want to remove ${u.name}?`)) {
                      deleteMutation.mutate(u.id);
                    }
                  }}
                  className="font-mono text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
                >
                  DELETE USER
                </button>
              )}
              {u.id === currentUser?.id && (
                <span className="font-mono text-[10px] text-muted">(CURRENT USER)</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
