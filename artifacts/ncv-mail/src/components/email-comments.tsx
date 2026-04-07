import {
  useGetEmailComments,
  useAddEmailComment,
  useUpdateEmailComment,
  useDeleteEmailComment,
  getGetEmailCommentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function EmailComments({ emailId, currentUserId }: { emailId: number; currentUserId?: string }) {
  const { data: comments, isLoading } = useGetEmailComments(emailId);
  const addComment = useAddEmailComment();
  const updateComment = useUpdateEmailComment();
  const deleteComment = useDeleteEmailComment();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getGetEmailCommentsQueryKey(emailId) });
  }

  async function handleAdd() {
    if (!newComment.trim()) return;
    try {
      await addComment.mutateAsync({ emailId, data: { body: newComment.trim() } });
      setNewComment("");
      invalidate();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  async function handleUpdate(commentId: string) {
    if (!editingText.trim()) return;
    try {
      await updateComment.mutateAsync({ emailId, commentId, data: { body: editingText.trim() } });
      setEditingId(null);
      setEditingText("");
      invalidate();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment.mutateAsync({ emailId, commentId });
      invalidate();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Erreur", variant: "destructive" });
    }
  }

  const commentList = (comments as any[]) || [];

  return (
    <div className="border-t border-border">
      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5 mb-3">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-medium text-primary uppercase tracking-wider">
            Notes internes ({commentList.length})
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : commentList.length > 0 ? (
          <div className="space-y-2.5 mb-3">
            {commentList.map((comment: any) => {
              const isOwn = comment.userId === currentUserId;
              const isEditing = editingId === comment.id;

              return (
                <div key={comment.id} className="bg-background rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-[11px] font-medium text-white">
                        {comment.authorName || "Anonyme"}
                      </span>
                      <span className="text-[10px] text-[#8b9cb3]">
                        {format(new Date(comment.createdAt), "d MMM yyyy HH:mm", { locale: fr })}
                      </span>
                      {comment.updatedAt !== comment.createdAt && (
                        <span className="text-[9px] text-[#8b9cb3] italic">(modifié)</span>
                      )}
                    </div>
                    {isOwn && !isEditing && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingId(comment.id); setEditingText(comment.body); }}
                          className="text-[#8b9cb3] hover:text-white p-0.5"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="text-[#8b9cb3] hover:text-red-400 p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="h-16 bg-card border-border text-white text-[12px] resize-none"
                        autoFocus
                      />
                      <div className="flex items-center gap-1.5 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingId(null); setEditingText(""); }}
                          className="h-6 text-[10px] text-[#8b9cb3]"
                        >
                          <X className="w-3 h-3 mr-0.5" /> Annuler
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(comment.id)}
                          disabled={!editingText.trim() || updateComment.isPending}
                          className="h-6 text-[10px]"
                        >
                          <Check className="w-3 h-3 mr-0.5" /> Sauver
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#c9d1d9] leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ajouter une note interne..."
            className="h-14 bg-background border-border text-white text-[12px] resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button
            size="sm"
            className="h-14 px-3"
            disabled={!newComment.trim() || addComment.isPending}
            onClick={handleAdd}
          >
            {addComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <p className="text-[9px] text-[#8b9cb3] mt-1">Ctrl+Entrée pour envoyer</p>
      </div>
    </div>
  );
}
