"use client";

import { useEffect } from "react";
import { Spinner } from "@/components/ui";

export default function Home() {
  useEffect(() => window.location.replace("/accounts/"), []);
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner label="Opening SentinelStack…" />
    </div>
  );
}
