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

export default function Equipe() {
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
      toast({ title: "Organisation créée" });
      setOrgName("");
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    try {
      const result = await inviteMutation.mutateAsync({
        data: { email: inviteEmail.trim(), role: inviteRole },
      });
      toast({ title: `Invitation envoyée à ${inviteEmail.trim()}` });
      setInviteEmail("");
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur lors de l'envoi", variant: "destructive" });
    }
  }

  async function handleCancelInvite(id: string) {
    try {
      await cancelInvite.mutateAsync({ invitationId: id });
      toast({ title: "Invitation annulée" });
      invalidateAll();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleRemoveMember(id: string, name: string) {
    if (!confirm(`Retirer ${name || "ce membre"} de l'organisation ?`)) return;
    try {
      await removeMember.mutateAsync({ memberId: id });
      toast({ title: "Membre retiré" });
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  async function handleChangeRole(memberId: string, newRole: "admin" | "member") {
    try {
      await updateRole.mutateAsync({ memberId, data: { role: newRole } });
      toast({ title: `Rôle mis à jour` });
      setShowRoleDropdown(null);
      invalidateAll();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  function copyInviteLink(token: string) {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/invitation/${token}`;
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
            <h2 className="text-lg font-semibold text-white mb-2">Créer votre organisation</h2>
            <p className="text-[13px] text-[#8b9cb3] mb-6">
              {isBusinessPlan
                ? "Créez votre organisation pour inviter vos collègues et collaborer."
                : "Le plan Business est requis pour créer une organisation. Passez au plan Business depuis la page Abonnement."}
            </p>
            {isBusinessPlan && (
              <div className="flex gap-2 max-w-sm mx-auto">
                <Input
                  placeholder="Nom de l'entreprise"
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
                    "Créer"
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
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {(org as any)?.name}
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">
              Plan {(org as any)?.plan} — {seatsUsed}/{seatsTotal} sièges utilisés
            </p>
          </div>
          {isAdmin && (
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                <Crown className="h-3 w-3" />
                Administrateur
              </span>
            </div>
          )}
        </div>

        <div className="bg-[#141c2b] rounded-xl border border-[#1f2937] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1f2937] flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-[#8b9cb3]" />
              Membres ({seatsUsed})
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
                        {member.fullName || "Sans nom"}
                      </span>
                      {member.role === "admin" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                          <Crown className="h-2.5 w-2.5" />
                          Admin
                        </span>
                      )}
                      {member.userId === (profile as any)?.id && (
                        <span className="text-[10px] text-[#8b9cb3]">(vous)</span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#8b9cb3]">{member.email}</span>
                  </div>
                </div>

                {isAdmin && member.userId !== (profile as any)?.id && (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() =>
                          setShowRoleDropdown(
                            showRoleDropdown === member.id ? null : member.id
                          )
                        }
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <Shield className="h-3 w-3" />
                        {member.role === "admin" ? "Admin" : "Membre"}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showRoleDropdown === member.id && (
                        <div className="absolute right-0 top-full mt-1 bg-[#1a2332] border border-[#1f2937] rounded-lg shadow-xl z-10 py-1 min-w-[120px]">
                          <button
                            onClick={() => handleChangeRole(member.id, "admin")}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
                          >
                            <Crown className="inline h-3 w-3 mr-1.5" />
                            Admin
                          </button>
                          <button
                            onClick={() => handleChangeRole(member.id, "member")}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
                          >
                            <Shield className="inline h-3 w-3 mr-1.5" />
                            Membre
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.id, member.fullName)}
                      className="p-1 rounded text-[#8b9cb3] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Retirer ce membre"
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
                Inviter un collègue
              </h2>
            </div>
            <div className="p-5">
              {seatsUsed >= seatsTotal ? (
                <p className="text-[12px] text-[#8b9cb3]">
                  Tous les sièges sont occupés ({seatsUsed}/{seatsTotal}).
                  Augmentez votre nombre de sièges depuis le portail Stripe dans la page Abonnement.
                </p>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Email du collègue"
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
                    <option value="member">Membre</option>
                    <option value="admin">Admin</option>
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
                        Inviter
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
                Invitations en attente ({pendingInvitations.length})
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
                        {inv.role === "admin" ? "Admin" : "Membre"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.token && (
                      <button
                        onClick={() => copyInviteLink(inv.token!)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] transition-colors"
                        title="Copier le lien d'invitation"
                      >
                        {copiedToken === inv.token ? (
                          <>
                            <Check className="h-3 w-3 text-green-400" />
                            <span className="text-green-400">Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copier le lien
                          </>
                        )}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleCancelInvite(inv.id)}
                        className="p-1 rounded text-[#8b9cb3] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Annuler l'invitation"
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
