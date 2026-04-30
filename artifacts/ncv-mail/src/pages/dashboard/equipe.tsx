import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useGetMyOrganisation,
  useGetOrganisationMembers,
  useGetOrganisationInvitations,
  useInviteToOrganisation,
  useCancelInvitation,
  useRemoveOrganisationMember,
  useUpdateMemberRole,
  useCreateOrganisation,
  useGetProfile,
  getGetMyOrganisationQueryKey,
  getGetOrganisationMembersQueryKey,
  getGetOrganisationInvitationsQueryKey,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  Trash2,
  Mail,
  Clock,
  Building2,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Equipe() {
  const { t } = useTranslation();
  const { data: profile } = useGetProfile();
  const { data: org, isLoading: orgLoading } = useGetMyOrganisation();
  const { data: members } = useGetOrganisationMembers();
  const { data: invitations } = useGetOrganisationInvitations();

  const createOrg = useCreateOrganisation();
  const inviteMutation = useInviteToOrganisation();
  const cancelInvite = useCancelInvitation();
  const removeMember = useRemoveOrganisationMember();
  const updateRole = useUpdateMemberRole();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; openUp: boolean } | null>(null);

  function openRoleDropdown(memberId: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (showRoleDropdown === memberId) {
      setShowRoleDropdown(null);
      setDropdownPos(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const menuHeight = 160;
    const menuWidth = 260;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < menuHeight + 16;
    setDropdownPos({
      top: openUp ? r.top - 8 : r.bottom + 8,
      left: Math.max(8, r.right - menuWidth),
      openUp,
    });
    setShowRoleDropdown(memberId);
  }

  const isAdmin = (org as any)?.myRole === "admin";
  const plan = (profile as any)?.plan;
  const isBusinessPlan = plan === "business";

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getGetMyOrganisationQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOrganisationMembersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOrganisationInvitationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
  }

  async function handleCreateOrg() {
    if (!orgName.trim()) return;
    try {
      await createOrg.mutateAsync({ data: { name: orgName.trim() } });
      toast({ title: t("team.orgCreated") });
      setOrgName("");
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("team.error"), variant: "destructive" });
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    try {
      const result: any = await inviteMutation.mutateAsync({
        data: { email: inviteEmail.trim(), role: inviteRole },
      });
      if (result?.directlyAdded) {
        toast({ title: `${inviteEmail.trim()} a été ajouté(e) à l'équipe` });
      } else {
        toast({ title: t("team.inviteSent", { email: inviteEmail.trim() }) });
      }
      setInviteEmail("");
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("team.inviteError"), variant: "destructive" });
    }
  }

  async function handleCancelInvite(id: string) {
    try {
      await cancelInvite.mutateAsync({ invitationId: id });
      toast({ title: t("team.inviteCancelled") });
      invalidateAll();
    } catch {
      toast({ title: t("team.error"), variant: "destructive" });
    }
  }

  async function handleRemoveMember(id: string, name: string) {
    if (!confirm(t("team.removeConfirm"))) return;
    try {
      await removeMember.mutateAsync({ memberId: id });
      toast({ title: t("team.memberRemoved") });
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("team.error"), variant: "destructive" });
    }
  }

  async function handleChangeRole(memberId: string, newRole: "admin" | "member") {
    try {
      await updateRole.mutateAsync({ memberId, data: { role: newRole } });
      toast({ title: t("team.roleUpdated") });
      setShowRoleDropdown(null);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("team.error"), variant: "destructive" });
    }
  }

  function copyInviteLink(token: string) {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  if (orgLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!org) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto px-4 py-12">
          <div className="bg-[#141c2b] rounded-xl border border-[#1f2937] p-8 text-center">
            <Building2 className="mx-auto h-12 w-12 text-[#8b9cb3]/40 mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">{t("team.createOrg")}</h2>
            <p className="text-[13px] text-[#8b9cb3] mb-6">
              {isBusinessPlan
                ? t("team.subtitle")
                : t("team.businessRequiredDesc")}
            </p>
            {isBusinessPlan && (
              <div className="flex gap-2 max-w-sm mx-auto">
                <Input
                  placeholder={t("team.orgNamePlaceholder")}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
                  className="bg-[#0d1117] border-[#1f2937] text-white"
                />
                <Button
                  onClick={handleCreateOrg}
                  disabled={!orgName.trim() || createOrg.isPending}
                  className="shrink-0"
                >
                  {createOrg.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("team.createOrg")
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const pendingInvitations = (invitations || []).filter((i: any) => i.status === "pending");
  const memberList = members || [];
  const seatsUsed = memberList.length;
  const seatsTotal = (org as any)?.seatsTotal || 3;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        <div className="mb-3">
          <Link href="/dashboard/parametres">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] text-[12px]"
              data-testid="back-to-settings"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("settings.title", "Paramètres")}
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {(org as any)?.name}
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">
              {(org as any)?.plan} — {seatsUsed}/{seatsTotal}
            </p>
          </div>
          {isAdmin && (
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                <Crown className="h-3 w-3" />
                {t("team.admin")}
              </span>
            </div>
          )}
        </div>

        <div className="bg-[#141c2b] rounded-xl border border-[#1f2937] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1f2937] flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-[#8b9cb3]" />
              {t("team.members")} ({seatsUsed})
            </h2>
          </div>

          <div className="divide-y divide-[#1f2937]">
            {(memberList as any[]).map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-[12px] font-semibold text-primary">
                    {(member.fullName || member.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-white">
                        {member.fullName || t("teamActivity.noName")}
                      </span>
                      {member.role === "admin" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                          <Crown className="h-2.5 w-2.5" />
                          Admin
                        </span>
                      )}
                      {member.userId === (profile as any)?.id && (
                        <span className="text-[10px] text-[#8b9cb3]">{t("team.you")}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#8b9cb3]">{member.email}</span>
                  </div>
                </div>

                {isAdmin && member.userId !== (profile as any)?.id && (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={(e) => openRoleDropdown(member.id, e)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <Shield className="h-3 w-3" />
                        {member.role === "admin" ? t("team.admin") : t("team.member")}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showRoleDropdown === member.id && dropdownPos && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => { setShowRoleDropdown(null); setDropdownPos(null); }}
                          />
                          <div
                            style={{
                              position: "fixed",
                              top: dropdownPos.openUp ? undefined : dropdownPos.top,
                              bottom: dropdownPos.openUp ? window.innerHeight - dropdownPos.top : undefined,
                              left: dropdownPos.left,
                              width: 260,
                            }}
                            className="bg-[#1a2332] border border-[#1f2937] rounded-lg shadow-2xl z-50 py-2">
                            <div className="px-3 pb-2 mb-1 border-b border-[#1f2937]">
                              <div className="text-[11px] font-medium text-white">
                                {t("team.changeRole") || "Changer le rôle"}
                              </div>
                              <div className="text-[10px] text-[#8b9cb3] truncate">
                                {member.fullName || member.email}
                              </div>
                            </div>
                            <button
                              onClick={() => handleChangeRole(member.id, "admin")}
                              className={`w-full text-left px-3 py-2 text-[12px] hover:bg-white/[0.06] flex items-start gap-2 ${
                                member.role === "admin" ? "text-primary" : "text-white"
                              }`}
                            >
                              <Crown className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <div className="font-medium">{t("team.admin")}</div>
                                <div className="text-[10px] text-[#8b9cb3] leading-snug">
                                  {t("team.adminDesc") || "Peut gérer l'équipe, l'abonnement et tous les emails"}
                                </div>
                              </div>
                            </button>
                            <button
                              onClick={() => handleChangeRole(member.id, "member")}
                              className={`w-full text-left px-3 py-2 text-[12px] hover:bg-white/[0.06] flex items-start gap-2 ${
                                member.role === "member" ? "text-primary" : "text-white"
                              }`}
                            >
                              <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <div className="font-medium">{t("team.member")}</div>
                                <div className="text-[10px] text-[#8b9cb3] leading-snug">
                                  {t("team.memberDesc") || "Accès à ses emails et aux tâches partagées"}
                                </div>
                              </div>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.id, member.fullName)}
                      className="p-1 rounded text-[#8b9cb3] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title={t("team.removeMember")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="bg-[#141c2b] rounded-xl border border-[#1f2937] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1f2937]">
              <h2 className="text-[14px] font-semibold text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[#8b9cb3]" />
                {t("team.invite")}
              </h2>
            </div>
            <div className="p-5">
              {seatsUsed >= seatsTotal ? (
                <p className="text-[12px] text-[#8b9cb3]">
                  {t("team.businessRequired")}
                </p>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder={t("team.inviteEmailPlaceholder")}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    className="bg-[#0d1117] border-[#1f2937] text-white flex-1"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                    className="bg-[#0d1117] border border-[#1f2937] text-white text-[12px] rounded-md px-2"
                  >
                    <option value="member">{t("team.member")}</option>
                    <option value="admin">{t("team.admin")}</option>
                  </select>
                  <Button
                    onClick={handleInvite}
                    disabled={!inviteEmail.trim() || inviteMutation.isPending}
                    className="shrink-0"
                  >
                    {inviteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Mail className="h-3.5 w-3.5 mr-1.5" />
                        {t("team.invite")}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {pendingInvitations.length > 0 && (
          <div className="bg-[#141c2b] rounded-xl border border-[#1f2937] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1f2937]">
              <h2 className="text-[14px] font-semibold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#8b9cb3]" />
                {t("team.invitations")} ({pendingInvitations.length})
              </h2>
            </div>
            <div className="divide-y divide-[#1f2937]">
              {(pendingInvitations as any[]).map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#1f2937] flex items-center justify-center">
                      <Mail className="h-3.5 w-3.5 text-[#8b9cb3]" />
                    </div>
                    <div>
                      <span className="text-[13px] text-white">{inv.email}</span>
                      <span className="text-[11px] text-[#8b9cb3] ml-2">
                        {inv.role === "admin" ? t("team.admin") : t("team.member")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.token && (
                      <button
                        onClick={() => copyInviteLink(inv.token!)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] transition-colors"
                        title={t("team.copyInviteLink")}
                      >
                        {copiedToken === inv.token ? (
                          <>
                            <Check className="h-3 w-3 text-green-400" />
                            <span className="text-green-400">{t("team.linkCopied")}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            {t("team.copyInviteLink")}
                          </>
                        )}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleCancelInvite(inv.id)}
                        className="p-1 rounded text-[#8b9cb3] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title={t("team.cancelInvite")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
