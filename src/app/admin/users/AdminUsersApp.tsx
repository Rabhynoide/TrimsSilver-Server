"use client";

import { useEffect, useRef, useState } from "react";
import { readJsonResponse } from "@/lib/http";

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isAdmin: boolean;
  hasFullAccess: boolean;
  createdAt: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminUsersApp({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await readJsonResponse<{ users?: AdminUser[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? `Échec de la requête (${res.status})`);
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchUsers();
  }, []);

  async function toggle(id: string, field: "hasFullAccess" | "isAdmin", value: boolean) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await readJsonResponse<{ user?: AdminUser; error?: string }>(res);
      if (!res.ok || !data.user) throw new Error(data.error ?? `Échec de la requête (${res.status})`);
      const updated = data.user;
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 w-full">
      <h1 className="text-2xl font-semibold text-navy-100">Administration — utilisateurs</h1>
      <p className="text-sm text-navy-400">
        Par défaut, un nouveau compte Discord n&apos;a accès qu&apos;à l&apos;Accueil et aux Prix du marché.
        Activez &quot;Accès complet&quot; pour lui ouvrir le reste du site (Agriculture, Artisanat, Quoi fabriquer,
        Registres, Flipper).
      </p>

      {error && (
        <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-navy-700">
        <table className="w-full min-w-[640px] table-fixed border-collapse">
          <thead>
            <tr className="divide-x divide-navy-700 bg-navy-850 text-navy-300">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide">Compte Discord</th>
              <th className="w-40 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide">Inscrit le</th>
              <th className="w-36 px-3 py-2 text-center text-xs font-medium uppercase tracking-wide">Accès complet</th>
              <th className="w-28 px-3 py-2 text-center text-xs font-medium uppercase tracking-wide">Admin</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-navy-400">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading &&
              users.map((u) => {
                const isSelf = u.id === currentUserId;
                const pending = pendingId === u.id;
                return (
                  <tr key={u.id} className="divide-x divide-navy-700 border-b border-navy-800">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {u.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.image} alt="" className="h-6 w-6 rounded-full" />
                        )}
                        <span className="text-sm text-navy-100">{u.name ?? u.email ?? u.id}</span>
                        {isSelf && <span className="text-xs text-navy-500">(vous)</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-navy-400">{formatDate(u.createdAt)}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={u.hasFullAccess}
                        disabled={isSelf || pending}
                        onChange={(e) => toggle(u.id, "hasFullAccess", e.target.checked)}
                        title={isSelf ? "Vous ne pouvez pas modifier votre propre accès" : undefined}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={u.isAdmin}
                        disabled={isSelf || pending}
                        onChange={(e) => toggle(u.id, "isAdmin", e.target.checked)}
                        title={isSelf ? "Vous ne pouvez pas modifier votre propre statut admin" : undefined}
                      />
                    </td>
                  </tr>
                );
              })}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-navy-400">
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
