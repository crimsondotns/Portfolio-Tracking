"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export function LoginSuccessToast() {
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        if (searchParams.get("login") === "success") {
            toast.success("Welcome back!");
            const newSearchParams = new URLSearchParams(searchParams.toString());
            newSearchParams.delete("login");
            const newPath = window.location.pathname + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : "");
            router.replace(newPath);
        } else if (searchParams.get("error") === "auth_failed") {
            toast.error("Login Failed");
            const newSearchParams = new URLSearchParams(searchParams.toString());
            newSearchParams.delete("error");
            const newPath = window.location.pathname + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : "");
            router.replace(newPath);
        }
    }, [searchParams, router]);

    return null;
}
