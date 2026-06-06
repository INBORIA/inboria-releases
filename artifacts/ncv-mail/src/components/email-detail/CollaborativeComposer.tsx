import { useEffect, useMemo, useRef } from "react";
import * as Y from "yjs";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { useTranslation } from "react-i18next";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Eraser,
} from "lucide-react";
import { SupabaseYjsProvider } from "@/lib/yjs-supabase-provider";
import { authJson } from "@/lib/api-fetch";

type Props = {
  /** Identifiant du brouillon partagé (= salle de co-édition). */
  draftId: string;
  /** HTML persisté à injecter si le document est encore vide. */
  initialHtml: string;
  /** Seul le créateur (ou un éditeur seul) amorce le contenu pour éviter les doublons. */
  canSeed: boolean;
  userName: string;
  userColor: string;
  /** Autres éditeurs présents en direct (hors soi) pour la barre de présence. */
  peers?: { userId: string; name: string; color: string }[];
  onChange: (html: string) => void;
  minHeight?: number;
};

/**
 * Éditeur de réponse co-édité en temps réel (type Google Docs), basé sur
 * TipTap (ProseMirror) + Yjs (CRDT) via le {@link SupabaseYjsProvider}.
 *
 * Utilisé UNIQUEMENT quand le brouillon partagé est activé. Le HTML produit
 * est remonté via `onChange` à l'identique de l'éditeur solo, donc l'envoi et
 * la persistance restent inchangés en aval.
 */
export function CollaborativeComposer({
  draftId,
  initialHtml,
  canSeed,
  userName,
  userColor,
  peers = [],
  onChange,
  minHeight = 480,
}: Props) {
  const { t } = useTranslation();
  const ydoc = useMemo(() => new Y.Doc(), [draftId]);
  const provider = useMemo(() => new SupabaseYjsProvider(`draft-${draftId}`, ydoc), [draftId, ydoc]);
  const seededRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string | null>(null);
  // Corps saisi en attente d'écriture (debounce non encore parti) — sert au flush.
  const pendingBodyRef = useRef<string | null>(null);

  const flushBody = () => {
    const html = pendingBodyRef.current;
    if (html === null) return;
    pendingBodyRef.current = null;
    lastPersistedRef.current = html;
    authJson(`api/drafts/${draftId}`, {
      method: "PATCH",
      body: JSON.stringify({ body: html }),
    }).catch(() => {});
  };

  // Persiste le corps en base (debounce) — le hook ne le fait plus en mode
  // collaboratif, donc c'est l'éditeur qui sauvegarde pour survivre au rechargement.
  const persistBody = (html: string) => {
    if (html === lastPersistedRef.current) return;
    pendingBodyRef.current = html;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(flushBody, 1000);
  };

  const editor = useEditor(
    {
      extensions: [
        // history désactivé : l'historique est géré par Yjs en mode collaboratif.
        StarterKit.configure({ history: false }),
        Underline,
        Link.configure({ openOnClick: false }),
        Collaboration.configure({ document: ydoc, field: "body" }),
        CollaborationCursor.configure({
          provider,
          user: { name: userName, color: userColor },
        }),
      ],
      editorProps: {
        attributes: {
          class:
            "signature-editor collab-editor rounded-md border border-border bg-card px-3 py-2 text-[13px] text-white outline-none focus:border-primary/50",
          style: `min-height:${minHeight}px`,
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        onChangeRef.current(html);
        persistBody(html);
      },
    },
    [ydoc, provider],
  );

  // Amorce le contenu une seule fois, après la synchro initiale, si le
  // document partagé est encore vide (premier rédacteur ou éditeur seul).
  useEffect(() => {
    if (!editor) return;
    const timer = setTimeout(() => {
      if (seededRef.current) return;
      seededRef.current = true;
      const fragment = ydoc.getXmlFragment("body");
      if (fragment.length === 0 && canSeed && initialHtml && initialHtml.trim()) {
        editor.commands.setContent(initialHtml, false);
        const html = editor.getHTML();
        onChangeRef.current(html);
        lastPersistedRef.current = html;
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [editor, ydoc, canSeed, initialHtml]);

  // Met à jour le nom/couleur affiché par le curseur collaboratif.
  useEffect(() => {
    provider.awareness.setLocalStateField("user", { name: userName, color: userColor });
  }, [provider, userName, userColor]);

  // Nettoyage : flush du corps en attente, déconnecte le provider, libère le document.
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      flushBody();
      provider.destroy();
      ydoc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, ydoc]);

  const btn =
    "h-7 w-7 inline-flex items-center justify-center rounded text-[#b8c5d6] hover:text-white hover:bg-white/[0.06] transition-colors";
  const btnActive = "bg-primary/20 text-primary";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap rounded-md border border-border bg-card px-2 py-1.5">
        <button
          type="button"
          title={t("signature.bold", "Gras")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`${btn} ${editor?.isActive("bold") ? btnActive : ""}`}
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title={t("signature.italic", "Italique")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`${btn} ${editor?.isActive("italic") ? btnActive : ""}`}
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title={t("signature.underline", "Souligné")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className={`${btn} ${editor?.isActive("underline") ? btnActive : ""}`}
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <button
          type="button"
          title={t("signature.bulletList", "Liste à puces")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`${btn} ${editor?.isActive("bulletList") ? btnActive : ""}`}
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title={t("signature.orderedList", "Liste numérotée")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`${btn} ${editor?.isActive("orderedList") ? btnActive : ""}`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <button
          type="button"
          title={t("signature.link", "Lien")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const prev = editor?.getAttributes("link").href as string | undefined;
            const url = window.prompt(t("signature.linkUrlPrompt", "URL du lien (https://...)"), prev || "");
            if (url === null) return;
            if (url === "") {
              editor?.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
            editor?.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
          }}
          className={`${btn} ${editor?.isActive("link") ? btnActive : ""}`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title={t("signature.clear", "Effacer mise en forme")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
          className={btn}
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>
        <span className="ml-auto flex items-center gap-2">
          <span
            className="flex items-center gap-1 text-[10px] text-white/90 rounded-full pl-1 pr-2 py-0.5"
            style={{ backgroundColor: `${userColor}22`, border: `1px solid ${userColor}` }}
            title={t("inbox.draftYou", "Vous")}
          >
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: userColor }} />
            {t("inbox.draftYou", "Vous")}
          </span>
          {peers.map((p) => (
            <span
              key={p.userId}
              className="flex items-center gap-1 text-[10px] text-white/90 rounded-full pl-1 pr-2 py-0.5 max-w-[120px]"
              style={{ backgroundColor: `${p.color}22`, border: `1px solid ${p.color}` }}
              title={p.name}
            >
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="truncate">{p.name}</span>
            </span>
          ))}
          <span className="flex items-center gap-1 text-[10px] text-primary/80">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t("inbox.draftLiveCoedit", "Co-édition en direct")}
          </span>
        </span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
