import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SERVICE_CODES } from "@shared/schema";
import type { Person } from "@shared/schema";

export default function Persons() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: persons = [], isLoading } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [pid, setPid] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  function openNew() { setPid(""); setFirstName(""); setLastName(""); setSelectedCodes([]); setNotes(""); setEditing(null); setOpen(true); }
  function openEdit(p: Person) {
    setPid(p.pid); setFirstName(p.firstName); setLastName(p.lastName);
    setSelectedCodes(JSON.parse(p.serviceCodesJson || "[]")); setNotes(p.notes || ""); setEditing(p); setOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/persons", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/persons"] }); setOpen(false); toast({ title: "Person added" }); },
    onError: () => toast({ title: "Error saving person", variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/persons/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/persons"] }); setOpen(false); toast({ title: "Person updated" }); },
    onError: () => toast({ title: "Error updating person", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/persons/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/persons"] }); toast({ title: "Person removed" }); },
  });

  function handleSave() {
    const data = { pid, firstName, lastName, serviceCodesJson: JSON.stringify(selectedCodes), notes };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  }

  const toggleCode = (c: string) => setSelectedCodes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Persons</h1>
          <p className="text-sm text-muted-foreground">Manage client PIDs and service codes</p>
        </div>
        <Button onClick={openNew} className="gap-1.5" data-testid="btn-add-person"><Plus size={15} /> Add Person</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Loading...</div> : persons.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              No persons added yet. Add persons to associate PIDs with entries.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {persons.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3" data-testid={`person-row-${p.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="mono font-bold text-primary text-sm">{p.pid}</span>
                      <span className="text-sm font-medium">{p.firstName} {p.lastName}</span>
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {JSON.parse(p.serviceCodesJson || "[]").map((c: string) => (
                        <span key={c} className="badge-info rounded px-1.5 py-0.5 text-xs">{c}</span>
                      ))}
                    </div>
                    {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="h-8 w-8" data-testid={`btn-edit-person-${p.id}`}><Edit2 size={13} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive" data-testid={`btn-delete-person-${p.id}`}><Trash2 size={13} /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Person" : "Add Person"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Person PID *</Label>
              <Input value={pid} onChange={e => setPid(e.target.value)} placeholder="e.g. 12345678" className="mono" data-testid="input-person-pid" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>First Name *</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} data-testid="input-first-name" />
              </div>
              <div className="space-y-1">
                <Label>Last Name *</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} data-testid="input-last-name" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Authorized Service Codes</Label>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_CODES.map(c => (
                  <button key={c} type="button" onClick={() => toggleCode(c)}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${selectedCodes.includes(c) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/60"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (internal)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." data-testid="input-person-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!pid || !firstName || !lastName} data-testid="btn-save-person">
              {editing ? "Update" : "Add Person"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
