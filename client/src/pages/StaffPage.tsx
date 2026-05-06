import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Staff } from "@shared/schema";

const ROLES = ["DSP", "Lead DSP", "Supervisor", "Program Manager", "Administrator", "Driver"];

export default function StaffPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: staffList = [], isLoading } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("DSP");

  function openNew() { setFullName(""); setRole("DSP"); setEditing(null); setOpen(true); }
  function openEdit(s: Staff) { setFullName(s.fullName); setRole(s.role || "DSP"); setEditing(s); setOpen(true); }

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/staff", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/staff"] }); setOpen(false); toast({ title: "Staff member added" }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/staff/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/staff"] }); setOpen(false); toast({ title: "Staff updated" }); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/staff/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/staff"] }); },
  });

  function handleSave() {
    const data = { fullName, role, active: true };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Staff</h1>
          <p className="text-sm text-muted-foreground">Manage DSP staff names for dropdown selection</p>
        </div>
        <Button onClick={openNew} className="gap-1.5" data-testid="btn-add-staff"><Plus size={15} /> Add Staff</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Loading...</div> : staffList.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              <UserCheck size={32} className="mx-auto mb-2 opacity-30" />
              No staff added yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {staffList.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3" data-testid={`staff-row-${s.id}`}>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">{s.role}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)} className="h-8 w-8"><Edit2 size={13} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Staff" : "Add Staff Member"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="First Last" data-testid="input-staff-name" />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger data-testid="select-staff-role"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!fullName} data-testid="btn-save-staff">{editing ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
