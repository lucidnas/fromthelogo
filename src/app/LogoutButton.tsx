"use client";

export default function LogoutButton() {
  return (
    <button
      onClick={() => { fetch("/api/auth", { method: "DELETE" }).then(() => window.location.href = "/login"); }}
      className="text-sm text-gray-500 hover:text-red-400 transition-colors"
    >
      Logout
    </button>
  );
}
