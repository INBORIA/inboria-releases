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
import { useState, useEffect, useCallback, useRef } from "react";
import type { PaginatedSharedMailboxEmails } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <p className="text-muted-foreground">{t("sharedMailboxes.businessOnly")}</p>
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
      toast({ title: t("sharedMailboxes.sharedSuccess") });
      setShareName("");
      setSharingConnectionId(null);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common.error"), variant: "destructive" });
    }
  }

  async function handleDeleteMailbox(id: string) {
    try {
      await deleteMailbox.mutateAsync({ mailboxId: id });
      toast({ title: t("sharedMailboxes.mailboxDeleted") });
      invalidateAll();
      if (selectedMailboxId === id) {
        setViewMode("list");
        setSelectedMailboxId(null);
      }
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common.error"), variant: "destructive" });
    }
  }

  async function handleAddMember(mailboxId: string) {
    if (!addMemberUserId) return;
    try {
      await addMember.mutateAsync({ mailboxId, data: { userId: addMemberUserId, canReply: true } });
      toast({ title: t("sharedMailboxes.memberAdded") });
      setAddMemberUserId("");
      invalidateMembers(mailboxId);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common.error"), variant: "destructive" });
    }
  }

  async function handleRemoveMember(mailboxId: string, memberId: string) {
    try {
      await removeMember.mutateAsync({ mailboxId, memberId });
      toast({ title: t("sharedMailboxes.memberRemoved") });
      invalidateMembers(mailboxId);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common.error"), variant: "destructive" });
    }
  }

  async function handleClaim(emailId: string) {
    try {
      await claimEmail.mutateAsync({ emailId });
      toast({ title: t("sharedMailboxes.emailClaimed") });
      if (selectedMailboxId) invalidateEmails(selectedMailboxId);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common.error"), variant: "destructive" });
    }
  }

  async function handleUnclaim(emailId: string) {
    try {
      await unclaimEmail.mutateAsync({ emailId });
      toast({ title: t("sharedMailboxes.emailUnclaimed") });
      if (selectedMailboxId) invalidateEmails(selectedMailboxId);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common.error"), variant: "destructive" });
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
            {viewMode === "list" && t("sharedMailboxes.title")}
            {viewMode === "detail" && (selectedMailbox?.name || t("sharedMailboxes.details"))}
            {viewMode === "emails" && `${selectedMailbox?.name || ""} — ${t("sharedMailboxes.emails")}`}
          </h1>
        </div>

        {viewMode === "list" && (
          <>
            {isAdmin && availableConnections.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-primary" />
                  {t("sharedMailboxes.shareTitle")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("sharedMailboxes.shareDesc")}
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
                            placeholder={t("sharedMailboxes.namePlaceholder")}
                            value={shareName}
                            onChange={(e) => setShareName(e.target.value)}
                            className="bg-background h-8 text-[12px] w-48"
                          />
                          <Button size="sm" onClick={() => handleShareConnection(conn.id)} disabled={createMailbox.isPending}>
                            {createMailbox.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.confirm")}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSharingConnectionId(null); setShareName(""); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => setSharingConnectionId(conn.id)}>
                          <Share2 className="h-3.5 w-3.5 mr-1.5" />
                          {t("sharedMailboxes.share")}
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
                        ? t("sharedMailboxes.noConnectionsDesc")
                        : t("sharedMailboxes.allShared")}
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
                <p className="text-muted-foreground">{t("sharedMailboxes.noMailboxes")}</p>
                {isAdmin && <p className="text-sm text-muted-foreground mt-1">{t("sharedMailboxes.shareToStart")}</p>}
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
                      <span className="flex items-center gap-1"><Users className="h-4 w-4" />{mb.memberCount || 0} {(mb.memberCount || 0) > 1 ? t("sharedMailboxes.membersPlural") : t("sharedMailboxes.member")}</span>
                      {mb.connectionId && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t("sharedMailboxes.connected")}
                        </span>
                      )}
                      {(mb.unclaimedCount || 0) > 0 && (
                        <span className="flex items-center gap-1 text-orange-400">
                          <Mail className="h-4 w-4" />{t("sharedMailboxes.unprocessedCount", { count: mb.unclaimedCount })}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEmails(mb.id)}>
                        <Mail className="h-4 w-4 mr-1" /> {t("sharedMailboxes.emails")}
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openDetail(mb.id)}>
                        <Users className="h-4 w-4 mr-1" /> {t("sharedMailboxes.members")}
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
  const { t } = useTranslation();
  const { data: members, isLoading } = useGetSharedMailboxMembers(mailboxId);

  const memberUserIds = new Set((members as any[])?.map((m: any) => m.userId) || []);
  const availableMembers = (orgMembers || []).filter((om: any) => !memberUserIds.has(om.userId));

  return (
    <div className="space-y-6">
      {isAdmin && availableMembers.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t("sharedMailboxes.addMember")}
          </h2>
          <div className="flex gap-3">
            <select
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
              value={addMemberUserId}
              onChange={(e) => setAddMemberUserId(e.target.value)}
            >
              <option value="">{t("sharedMailboxes.selectColleague")}</option>
              {availableMembers.map((om: any) => (
                <option key={om.userId} value={om.userId}>
                  {om.fullName || om.email || om.userId}
                </option>
              ))}
            </select>
            <Button onClick={() => onAddMember(mailboxId)} disabled={!addMemberUserId}>
              {t("sharedMailboxes.add")}
            </Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {t("sharedMailboxes.members")} ({(members as any[])?.length || 0})
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !members || (members as any[]).length === 0 ? (
          <p className="text-muted-foreground text-center py-6">{t("sharedMailboxes.noMembers")}</p>
        ) : (
          <div className="space-y-3">
            {(members as any[]).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between bg-background rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{m.fullName || t("sharedMailboxes.noName")}</p>
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
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [accumulatedEmails, setAccumulatedEmails] = useState<PaginatedSharedMailboxEmails["emails"]>([]);
  const { data: emailsData, isLoading, isFetching } = useGetSharedMailboxEmails(mailboxId, { filter, page, limit: 50 });
  const paged = emailsData as PaginatedSharedMailboxEmails | undefined;
  const hasMore = paged ? page < (paged.totalPages ?? 1) : false;

  useEffect(() => {
    if (paged) {
      if (page === 1) {
        setAccumulatedEmails(paged.emails || []);
      } else {
        setAccumulatedEmails((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const unique = (paged.emails || []).filter((e) => !existingIds.has(e.id));
          return [...prev, ...unique];
        });
      }
    }
  }, [paged, page]);

  useEffect(() => {
    setPage(1);
    setAccumulatedEmails([]);
  }, [filter, mailboxId]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isFetching]);

  const emails = accumulatedEmails;
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
        toast({ title: count > 0 ? t("sharedMailboxes.syncedCount", { count }) : t("sharedMailboxes.syncNoNew") });
        setPage(1);
        setAccumulatedEmails([]);
        queryClient.invalidateQueries({ queryKey: getGetSharedMailboxEmailsQueryKey(mailboxId) });
      } else {
        toast({ title: result.error || t("sharedMailboxes.syncFailed"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("sharedMailboxes.syncError"), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  const filterOptions = [
    { value: "all" as const, label: t("sharedMailboxes.allEmails") },
    { value: "unclaimed" as const, label: t("sharedMailboxes.unclaimed") },
    { value: "mine" as const, label: t("sharedMailboxes.mine") },
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
          {t("sharedMailboxes.sync")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : emails.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{t("sharedMailboxes.noEmailsInView")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <div key={email.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{email.sender}</span>
                    {email.priority === "urgent" && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{t("inbox.priorities.urgent")}</span>
                    )}
                    {email.priority === "moyen" && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">{t("inbox.priorities.medium")}</span>
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
                        <Hand className="h-3 w-3 mr-1" /> {t("sharedMailboxes.release")}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> {email.claimedByName || t("sharedMailboxes.colleague")}
                      </span>
                    )
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => onClaim(email.id)} className="text-green-400 border-green-400/30">
                      <Hand className="h-3 w-3 mr-1" /> {t("sharedMailboxes.take")}
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
                    {t("sharedMailboxes.claimedByOn", { name: email.claimedByName, date: new Date(email.claimedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) })}
                  </span>
                )}
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="flex items-center justify-center py-4">
              <button
                onClick={loadMore}
                disabled={isFetching}
                className="text-[11px] text-primary hover:text-white transition-colors px-3 py-1.5 rounded-md border border-primary/20 hover:border-primary/40 disabled:opacity-50"
              >
                {isFetching ? t("common.loading") : t("sharedMailboxes.loadMoreEmails")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
