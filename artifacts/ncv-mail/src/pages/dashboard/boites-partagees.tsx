import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useGetSharedMailboxes,
  useCreateSharedMailbox,
  useDeleteSharedMailbox,
  useGetSharedMailboxMembers,
  useAddSharedMailboxMember,
  useRemoveSharedMailboxMember,
  useGetSharedMailboxEmails,
  useClaimSharedEmail,
  useUnclaimSharedEmail,
  useForceSharedMailboxSync,
  useGetOrganisationMembers,
  useGetMyOrganisation,
  useGetProfile,
  useGetAdminConnections,
  getGetSharedMailboxesQueryKey,
  getGetSharedMailboxMembersQueryKey,
  getGetSharedMailboxEmailsQueryKey,
  getGetAdminConnectionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MailPlus,
  Trash2,
  UserPlus,
  Users,
  Loader2,
  Inbox,
  Hand,
  ArrowLeft,
  Mail,
  Clock,
  User,
  X,
  Share2,
  CheckCircle2,
  Link,
  RefreshCw,
} from "lucide-react";

type ViewMode = "list" | "detail" | "emails";

export default function BoitesPartagees() {
  const { data: profile } = useGetProfile();
  const { data: org } = useGetMyOrganisation();
  const isAdmin = (org as any)?.myRole === "admin";
  const plan = (profile as any)?.plan;

  const { data: mailboxes, isLoading } = useGetSharedMailboxes();
  const { data: orgMembers } = useGetOrganisationMembers();
  const { data: adminConnections } = useGetAdminConnections({ query: { enabled: !!isAdmin } });

  const createMailbox = useCreateSharedMailbox();
  const deleteMailbox = useDeleteSharedMailbox();
  const addMember = useAddSharedMailboxMember();
  const removeMember = useRemoveSharedMailboxMember();
  const claimEmail = useClaimSharedEmail();
  const unclaimEmail = useUnclaimSharedEmail();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState<"all" | "unclaimed" | "mine">("all");
  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [shareName, setShareName] = useState("");
  const [sharingConnectionId, setSharingConnectionId] = useState<string | null>(null);

  if (plan !== "business") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Disponible avec le plan Business uniquement.</p>
        </div>
      </DashboardLayout>
    );
  }

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getGetSharedMailboxesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAdminConnectionsQueryKey() });
  }

  function invalidateMembers(mailboxId: string) {
    queryClient.invalidateQueries({ queryKey: getGetSharedMailboxMembersQueryKey(mailboxId) });
  }

  function invalidateEmails(mailboxId: string) {
    queryClient.invalidateQueries({ queryKey: getGetSharedMailboxEmailsQueryKey(mailboxId, { filter: emailFilter as any }) });
  }

  async function handleShareConnection(connectionId: string) {
    try {
      await createMailbox.mutateAsync({ data: { connectionId, name: shareName.trim() || undefined } });
      toast({ title: "Adresse partagée avec l'équipe" });
      setShareName("");
      setSharingConnectionId(null);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  async function handleDeleteMailbox(id: string) {
    try {
      await deleteMailbox.mutateAsync({ mailboxId: id });
      toast({ title: "Partage supprime" });
      invalidateAll();
      if (selectedMailboxId === id) {
        setViewMode("list");
        setSelectedMailboxId(null);
      }
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  async function handleAddMember(mailboxId: string) {
    if (!addMemberUserId) return;
    try {
      await addMember.mutateAsync({ mailboxId, data: { userId: addMemberUserId, canReply: true } });
      toast({ title: "Membre ajoute" });
      setAddMemberUserId("");
      invalidateMembers(mailboxId);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  async function handleRemoveMember(mailboxId: string, memberId: string) {
    try {
      await removeMember.mutateAsync({ mailboxId, memberId });
      toast({ title: "Membre retiré" });
      invalidateMembers(mailboxId);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  async function handleClaim(emailId: string) {
    try {
      await claimEmail.mutateAsync({ emailId });
      toast({ title: "Email pris en charge" });
      if (selectedMailboxId) invalidateEmails(selectedMailboxId);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  async function handleUnclaim(emailId: string) {
    try {
      await unclaimEmail.mutateAsync({ emailId });
      toast({ title: "Email relâché" });
      if (selectedMailboxId) invalidateEmails(selectedMailboxId);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  function openDetail(mailboxId: string) {
    setSelectedMailboxId(mailboxId);
    setViewMode("detail");
  }

  function openEmails(mailboxId: string) {
    setSelectedMailboxId(mailboxId);
    setEmailFilter("all");
    setViewMode("emails");
  }

  const selectedMailbox = (mailboxes as any[])?.find((m: any) => m.id === selectedMailboxId);

  const availableConnections = ((adminConnections as any[]) || []).filter((c: any) => !c.alreadyShared);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          {viewMode !== "list" && (
            <Button variant="ghost" size="icon" onClick={() => { setViewMode("list"); setSelectedMailboxId(null); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <MailPlus className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">
            {viewMode === "list" && "Boîtes partagées"}
            {viewMode === "detail" && (selectedMailbox?.name || "Détails")}
            {viewMode === "emails" && `${selectedMailbox?.name || ""} — Emails`}
          </h1>
        </div>

        {viewMode === "list" && (
          <>
            {isAdmin && availableConnections.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-primary" />
                  Partager une adresse avec l'équipe
                </h2>
                <p className="text-xs text-muted-foreground">
                  Sélectionnez une adresse connectée dans vos Paramètres pour la partager avec les membres de votre équipe.
                </p>
                <div className="space-y-2">
                  {availableConnections.map((conn: any) => (
                    <div key={conn.id} className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border border-border rounded-lg bg-background">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                          conn.provider === "gmail" ? "bg-red-500/10 text-red-400" :
                          conn.provider === "outlook" ? "bg-blue-500/10 text-blue-400" :
                          "bg-white/[0.06] text-[#8b9cb3]"
                        }`}>
                          {conn.provider === "gmail" ? "G" : conn.provider === "outlook" ? "O" : "@"}
                        </div>
                        <div>
                          <h4 className="font-medium text-[13px] text-white">{conn.emailAddress}</h4>
                          <p className="text-[11px] text-[#8b9cb3]">{conn.provider === "gmail" ? "Gmail" : conn.provider === "outlook" ? "Outlook" : "IMAP"}</p>
                        </div>
                      </div>
                      {sharingConnectionId === conn.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Nom (optionnel, ex: Support)"
                            value={shareName}
                            onChange={(e) => setShareName(e.target.value)}
                            className="bg-background h-8 text-[12px] w-48"
                          />
                          <Button size="sm" onClick={() => handleShareConnection(conn.id)} disabled={createMailbox.isPending}>
                            {createMailbox.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmer"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSharingConnectionId(null); setShareName(""); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => setSharingConnectionId(conn.id)}>
                          <Share2 className="h-3.5 w-3.5 mr-1.5" />
                          Partager
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isAdmin && availableConnections.length === 0 && !isLoading && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <Link className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {((adminConnections as any[]) || []).length === 0
                        ? "Aucune adresse email connectée. Connectez d'abord une adresse dans Paramètres pour pouvoir la partager."
                        : "Toutes vos adresses connectées sont déjà partagées."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !mailboxes || (mailboxes as any[]).length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Aucune boîte partagée pour le moment.</p>
                {isAdmin && <p className="text-sm text-muted-foreground mt-1">Partagez une adresse connectée ci-dessus pour commencer.</p>}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(mailboxes as any[]).map((mb: any) => (
                  <div key={mb.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{mb.name}</h3>
                        <p className="text-sm text-muted-foreground">{mb.emailAddress}</p>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteMailbox(mb.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-4 w-4" />{mb.memberCount || 0} membre{(mb.memberCount || 0) > 1 ? "s" : ""}</span>
                      {mb.connectionId && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Connectée
                        </span>
                      )}
                      {(mb.unclaimedCount || 0) > 0 && (
                        <span className="flex items-center gap-1 text-orange-400">
                          <Mail className="h-4 w-4" />{mb.unclaimedCount} non traite{mb.unclaimedCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEmails(mb.id)}>
                        <Mail className="h-4 w-4 mr-1" /> Emails
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openDetail(mb.id)}>
                        <Users className="h-4 w-4 mr-1" /> Membres
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {viewMode === "detail" && selectedMailboxId && <MailboxDetail
          mailboxId={selectedMailboxId}
          isAdmin={isAdmin}
          orgMembers={orgMembers as any[]}
          addMemberUserId={addMemberUserId}
          setAddMemberUserId={setAddMemberUserId}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />}

        {viewMode === "emails" && selectedMailboxId && <MailboxEmails
          mailboxId={selectedMailboxId}
          filter={emailFilter}
          setFilter={setEmailFilter}
          userId={(profile as any)?.id}
          onClaim={handleClaim}
          onUnclaim={handleUnclaim}
        />}
      </div>
    </DashboardLayout>
  );
}

function MailboxDetail({
  mailboxId, isAdmin, orgMembers, addMemberUserId, setAddMemberUserId, onAddMember, onRemoveMember,
}: {
  mailboxId: string;
  isAdmin: boolean;
  orgMembers: any[];
  addMemberUserId: string;
  setAddMemberUserId: (v: string) => void;
  onAddMember: (mailboxId: string) => void;
  onRemoveMember: (mailboxId: string, memberId: string) => void;
}) {
  const { data: members, isLoading } = useGetSharedMailboxMembers(mailboxId);

  const memberUserIds = new Set((members as any[])?.map((m: any) => m.userId) || []);
  const availableMembers = (orgMembers || []).filter((om: any) => !memberUserIds.has(om.userId));

  return (
    <div className="space-y-6">
      {isAdmin && availableMembers.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Ajouter un membre
          </h2>
          <div className="flex gap-3">
            <select
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
              value={addMemberUserId}
              onChange={(e) => setAddMemberUserId(e.target.value)}
            >
              <option value="">Sélectionner un collègue...</option>
              {availableMembers.map((om: any) => (
                <option key={om.userId} value={om.userId}>
                  {om.fullName || om.email || om.userId}
                </option>
              ))}
            </select>
            <Button onClick={() => onAddMember(mailboxId)} disabled={!addMemberUserId}>
              Ajouter
            </Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Membres ({(members as any[])?.length || 0})
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !members || (members as any[]).length === 0 ? (
          <p className="text-muted-foreground text-center py-6">Aucun membre.</p>
        ) : (
          <div className="space-y-3">
            {(members as any[]).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between bg-background rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{m.fullName || "Sans nom"}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onRemoveMember(mailboxId, m.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MailboxEmails({
  mailboxId, filter, setFilter, userId, onClaim, onUnclaim,
}: {
  mailboxId: string;
  filter: "all" | "unclaimed" | "mine";
  setFilter: (v: "all" | "unclaimed" | "mine") => void;
  userId: string;
  onClaim: (emailId: string) => void;
  onUnclaim: (emailId: string) => void;
}) {
  const { data: emailsData, isLoading } = useGetSharedMailboxEmails(mailboxId, { filter: filter as any });
  const emails = (emailsData as any)?.emails || emailsData;
  const forceSync = useForceSharedMailboxSync();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  async function handleForceSync() {
    setSyncing(true);
    try {
      const result = await forceSync.mutateAsync({ mailboxId });
      if (result.success) {
        const count = result.synced ?? 0;
        toast({ title: count > 0 ? `${count} nouveau(x) email(s) synchronisé(s)` : "Synchronisation terminée, aucun nouvel email" });
        queryClient.invalidateQueries({ queryKey: getGetSharedMailboxEmailsQueryKey(mailboxId, { filter: filter as any }) });
      } else {
        toast({ title: result.error || "La synchronisation a échoué", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur de synchronisation", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  const filterOptions = [
    { value: "all" as const, label: "Tous" },
    { value: "unclaimed" as const, label: "Non attribués" },
    { value: "mine" as const, label: "Mes emails" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {filterOptions.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleForceSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Synchroniser
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !emails || (emails as any[]).length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Aucun email dans cette vue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(emails as any[]).map((email: any) => (
            <div key={email.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{email.sender}</span>
                    {email.priority === "urgent" && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Urgent</span>
                    )}
                    {email.priority === "moyen" && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Moyen</span>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-0.5">{email.subject}</p>
                  {email.summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{email.summary}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {email.claimedBy ? (
                    email.claimedBy === userId ? (
                      <Button variant="outline" size="sm" onClick={() => onUnclaim(email.id)} className="text-orange-400 border-orange-400/30">
                        <Hand className="h-3 w-3 mr-1" /> Relacher
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> {email.claimedByName || "Collegue"}
                      </span>
                    )
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => onClaim(email.id)} className="text-green-400 border-green-400/30">
                      <Hand className="h-3 w-3 mr-1" /> Prendre
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(email.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                {email.claimedAt && email.claimedByName && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Pris par {email.claimedByName} le {new Date(email.claimedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
