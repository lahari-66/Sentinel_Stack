"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Account } from "@/lib/types";
import { inputClass } from "./ui";

/**
 * Loads connected accounts and keeps the selected one in the ?account= query string,
 * so links like /scans/?account=123456789012 open the right account.
 */
export function useSelectedAccount() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listAccounts()
      .then((all) => {
        const connected = all.filter((a) => a.status === "connected");
        setAccounts(connected);
        const requested = new URLSearchParams(window.location.search).get("account");
        setSelected(connected.find((a) => a.account_id === requested)?.account_id ?? connected[0]?.account_id ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  function select(accountId: string) {
    setSelected(accountId);
    const url = new URL(window.location.href);
    url.searchParams.set("account", accountId);
    window.history.replaceState(null, "", url);
  }

  return { accounts, selected, select, error };
}

export function AccountPicker({ accounts, selected, onSelect }: { accounts: Account[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <select className={`${inputClass.replace("w-full", "w-auto")} font-mono`} value={selected} onChange={(e) => onSelect(e.target.value)} aria-label="Account">
      {accounts.map((a) => (
        <option key={a.account_id} value={a.account_id}>
          {a.account_id} ({a.region})
        </option>
      ))}
    </select>
  );
}
