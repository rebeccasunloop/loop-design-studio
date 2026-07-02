"use client";

// Lightweight tester identity for the no-SSO beta week: ask once for a Loop
// email, keep it in localStorage, and send it as the x-user-email header so
// sessions and analytics are attributed per person. Replaced by Cloudflare
// Access / SSO identity when the app runs behind an authenticated tunnel.

const STORAGE_KEY = "studio.tester.email";
const ALLOWED = ["bankonloop.com", "loop.ca"];

export function getTesterEmail(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  for (let attempt = 0; attempt < 3; attempt++) {
    const input = window.prompt(
      "Welcome to Loop Design Studio (beta).\nEnter your Loop email so your sessions are saved under your name:"
    );
    if (!input) break;
    const email = input.trim().toLowerCase();
    if (ALLOWED.includes(email.split("@")[1] ?? "")) {
      window.localStorage.setItem(STORAGE_KEY, email);
      return email;
    }
    window.alert("Please use your @bankonloop.com email.");
  }
  return null;
}

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const email = getTesterEmail();
  const headers = new Headers(init?.headers);
  if (email) headers.set("x-user-email", email);
  return fetch(url, { ...init, headers });
}
