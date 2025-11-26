"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export function LoginSuccessToast() {
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const loginStatus = searchParams.get("login");
        const errorMessage = searchParams.get("error");

        // กรณี Login สำเร็จ (สีเขียว)
        if (loginStatus === "success") {
            toast.success("Welcome back!", {
                description: "Signed in successfully."
            });
            
            // ล้าง URL param 'login' ออก
            const newSearchParams = new URLSearchParams(searchParams.toString());
            newSearchParams.delete("login");
            const newPath = window.location.pathname + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : "");
            router.replace(newPath);
        } 
        
        // ✅ กรณีเกิด Error (สีแดง) - อ่านข้อความจริงจาก URL
        else if (errorMessage) {
            toast.error("Login Failed", {
                description: decodeURIComponent(errorMessage) // แสดงข้อความ Error ที่แท้จริง
            });

            // ล้าง URL param 'error' ออก
            const newSearchParams = new URLSearchParams(searchParams.toString());
            newSearchParams.delete("error");
            const newPath = window.location.pathname + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : "");
            router.replace(newPath);
        }
    }, [searchParams, router]);

    return null;
}
