"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "../lib/supabase";
import { fetchAllPages } from "../lib/supabasePaging";
const TYPES = [
  "manga",
  "manhwa",
  "manwha",
  "webtoon",
  "roman",
  "novel",
  "book",
];
export default function ExportReadings() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const saved = localStorage.getItem("steldra_multimedia_list_v1");
      let readings: any[] = [];
      if (saved) {
        const local = JSON.parse(saved);
        let progress: Record<string, number> = {};
        const raw = localStorage.getItem("steldra_manga_progress_v1");
        if (raw) progress = JSON.parse(raw);
        readings = Object.entries(local).flatMap(([key, value]) => {
          const entry = value as any;
          return TYPES.includes(entry?.media?.type)
            ? [{ ...entry, manga_progress: progress[key] || 0 }]
            : [];
        });
      }
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await fetchAllPages<any>((from, to) =>
          supabase
            .from("media_progress")
            .select("*")
            .eq("user_id", user.id)
            .in("media_type", TYPES)
            .order("media_id", { ascending: true })
            .range(from, to),
        );
        if (error) throw error;
        const map = new Map(
          readings.map((r) => [`${r.media.type}_${r.media.id}`, r]),
        );
        for (const row of data)
          map.set(`${row.media_type}_${row.media_id}`, row);
        readings = [...map.values()];
        const { data: lists, error: listError } = await supabase
          .from("custom_lists")
          .select("id,name")
          .eq("user_id", user.id);
        if (listError) throw listError;
        if (lists?.length) {
          const ids = lists.map((l) => l.id);
          const { data: items, error: itemError } = await fetchAllPages<any>(
            (from, to) =>
              supabase
                .from("custom_list_items")
                .select("*")
                .in("list_id", ids)
                .in("media_type", TYPES)
                .order("id", { ascending: true })
                .range(from, to),
          );
          if (itemError) throw itemError;
          const names = new Map(lists.map((l) => [l.id, l.name]));
          const memberships = new Map<string, string[]>();
          for (const item of items) {
            const key = `${item.media_type}_${item.media_id}`;
            const name = names.get(item.list_id);
            if (name)
              memberships.set(key, [
                ...new Set([...(memberships.get(key) || []), String(name)]),
              ]);
            if (!map.has(key))
              map.set(key, { ...item, status: "a_voir", manga_progress: 0 });
          }
          readings = [...map.entries()].map(([key, row]) => ({
            ...row,
            lists: memberships.get(key) || row.lists || [],
          }));
        }
      } else if (authError && !readings.length)
        throw new Error("Connectez-vous pour exporter vos lectures Supabase.");
      const payload = {
        version: 1,
        source: "steldra-reading-export",
        exportedAt: new Date().toISOString(),
        readings,
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "steldra-lectures.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        `${readings.length} lecture(s) exportée(s). Aucune donnée n’a été supprimée.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Export impossible. Vérifiez votre connexion puis réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "50px auto",
        padding: 24,
        background: "#fff",
        color: "#222",
        borderRadius: 16,
      }}
    >
      <Link href="/collection">← Collection cinéma</Link>
      <h1>Mes anciennes lectures</h1>
      <p>
        Exportez les mangas et manhwas déjà enregistrés pour les importer dans
        LIRDRA.
      </p>
      <p>
        Le titre, le type, le statut, la progression en chapitres, la
        couverture, les genres, les listes et les favoris sont conservés
        lorsqu’ils existent dans les données.
      </p>
      <button disabled={busy} onClick={() => void run()}>
        {busy ? "Export en cours…" : "Télécharger mes lectures en JSON"}
      </button>
      <p role="status">{message}</p>
      <p>
        Dans LIRDRA : Bibliothèque → Importer un JSON. Cette opération ne
        supprime rien de STELDRA et ne transfère pas vos identifiants de
        connexion.
      </p>
    </main>
  );
}
