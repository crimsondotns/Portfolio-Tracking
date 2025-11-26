"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";

export default function AuthCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const handleAuth = async () => {
            const code = searchParams.get("code");
            const error = searchParams.get("error");
            const error_description = searchParams.get("error_description");

            if (error) {
                toast.error(error_description || "Authentication failed");
                router.replace("/?error=auth_failed");
                return;
            }

            if (code) {
                // Handle PKCE Code
                const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
                if (sessionError) {
                    toast.error(sessionError.message);
                    router.replace("/?error=auth_failed");
                } else {
                    // Success
                    router.replace("/?login=success");
                }
            } else {
                // Handle Implicit (Hash) - Supabase client handles this automatically on init/getSession
                // We check if a session exists or wait for the auth state change
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    router.replace("/?login=success");
                } else {
                    // Listen for the event in case it's processing the hash
                    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                        if (event === 'SIGNED_IN') {
                            router.replace("/?login=success");
                        }
                    });

                    // If after a short timeout we still don't have a session and no code, it might be a direct visit or failed hash
                    // But we shouldn't redirect to error immediately to avoid loops if it's just loading
                }
            }
        };

        handleAuth();
    }, [router, searchParams]);

    return (
        <div className="flex h-screen w-full items-center justify-center bg-black text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
                <p className="text-zinc-400">Authenticating...</p>
            </div>
        </div>
    );
}
