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
        <p className="text-sm text-neutral-400">
          Sign in with Discord to save and load Price Checker favorites.
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
    return <p className="text-sm text-neutral-400">Loading favorites…</p>;
  }

  if (favorites.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No favorites yet. Build a selection on the Price Checker tab and save it.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {favorites.map((favorite) => (
        <li
          key={favorite.id}
          className="flex items-center justify-between gap-4 rounded border border-neutral-800 px-3 py-2"
        >
          <div>
            <p className="font-medium">{favorite.name}</p>
            {favorite.note && <p className="text-xs text-neutral-400">{favorite.note}</p>}
            <p className="text-xs text-neutral-500">{favorite.config.items.length} items</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onLoad(favorite)}
              className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              Load
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(favorite)}
              className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => onDelete(favorite)}
              className="rounded bg-red-900 px-3 py-1.5 text-sm hover:bg-red-800"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
