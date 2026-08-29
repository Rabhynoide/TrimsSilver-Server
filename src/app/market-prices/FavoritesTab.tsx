"use client";

import type { Favorite } from "./types";

export default function FavoritesTab({
  isSignedIn,
  favorites,
  loading,
  onLoad,
  onDuplicate,
  onDelete,
  onSignIn,
}: {
  isSignedIn: boolean;
  favorites: Favorite[];
  loading: boolean;
  onLoad: (favorite: Favorite) => void;
  onDuplicate: (favorite: Favorite) => void;
  onDelete: (favorite: Favorite) => void;
  onSignIn: () => void;
}) {
  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-navy-300">
          Connectez-vous avec Discord pour enregistrer et charger vos favoris du vérificateur de
          prix.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="rounded bg-[#5865F2] px-4 py-2 text-sm text-white hover:bg-[#4752C4]"
        >
          Se connecter avec Discord
        </button>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-navy-300">Chargement des favoris…</p>;
  }

  if (favorites.length === 0) {
    return (
      <p className="text-sm text-navy-400">
        Aucun favori pour le moment. Créez une sélection dans l&apos;onglet Vérificateur de prix
        et enregistrez-la.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {favorites.map((favorite) => (
        <li
          key={favorite.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-navy-700 bg-navy-850 px-3 py-2"
        >
          <div>
            <p className="font-medium text-navy-100">{favorite.name}</p>
            {favorite.note && <p className="text-xs text-navy-400">{favorite.note}</p>}
            <p className="text-xs text-navy-500">{favorite.config.items.length} objets</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onLoad(favorite)}
              className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700"
            >
              Charger
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(favorite)}
              className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700"
            >
              Dupliquer
            </button>
            <button
              type="button"
              onClick={() => onDelete(favorite)}
              className="rounded bg-red-900 px-3 py-1.5 text-sm text-red-100 hover:bg-red-800"
            >
              Supprimer
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
