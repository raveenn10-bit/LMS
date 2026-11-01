"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return <button className="portal-signout" onClick={async () => {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }}><LogOut size={16}/> Sign out</button>;
}
