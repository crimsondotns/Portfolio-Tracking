"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    onUserUpdated: (updatedUser: any) => void; // ✅ เพิ่ม Prop นี้
}

export function EditProfileModal({ isOpen, onClose, user, onUserUpdated }: EditProfileModalProps) {
    const router = useRouter();
    const [displayName, setDisplayName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        setMounted(true);
        if (user) {
            setDisplayName(user.user_metadata?.full_name || "");
            setPreviewUrl(user.user_metadata?.avatar_url || null);
        }
    }, [user, isOpen]);

    if (!isOpen || !mounted || typeof document === 'undefined') return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("File size too large", {
                    description: "Please upload an image smaller than 5MB."
                });
                return;
            }
            setAvatarFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleResetToDefault = async () => {
        if (!confirm("Reset profile to default settings?")) return;
        
        setIsLoading(true);
        try {
            const identities = user?.identities || [];
            const googleIdentity = identities.find((id: any) => id.provider === 'google');
            
            let targetAvatarUrl = null;
            let targetFullName = null;

            if (googleIdentity) {
                targetAvatarUrl = googleIdentity.identity_data?.avatar_url || null;
                targetFullName = googleIdentity.identity_data?.full_name || googleIdentity.identity_data?.name || null;
            } 

            // ✅ รับค่า data กลับมาด้วย
            const { data, error } = await supabase.auth.updateUser({
                data: { 
                    avatar_url: targetAvatarUrl,
                    full_name: targetFullName 
                }
            });

            if (error) throw error;

            setPreviewUrl(targetAvatarUrl);
            setAvatarFile(null);
            setDisplayName(targetFullName || "");
            
            // ✅ อัปเดต User ที่หน้าเว็บทันที
            if (data.user) {
                onUserUpdated(data.user);
            }

            toast.success(googleIdentity ? "Reset to Google profile!" : "Profile cleared to empty!");
            router.refresh();
        } catch (error: any) {
            toast.error("Failed to reset profile", { description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            let avatarUrl = user.user_metadata?.avatar_url;

            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, avatarFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                avatarUrl = publicUrl;
            }

            // ✅ รับค่า data กลับมาด้วย
            const { data, error: updateError } = await supabase.auth.updateUser({
                data: {
                    full_name: displayName,
                    avatar_url: avatarUrl
                }
            });

            if (updateError) throw updateError;

            // ✅ อัปเดต User ที่หน้าเว็บทันที
            if (data.user) {
                onUserUpdated(data.user);
            }

            toast.success("Profile updated successfully!");
            router.refresh();
            onClose();
        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast.error("Failed to update profile", { description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="relative w-full max-w-md mx-4 overflow-hidden rounded-lg border border-zinc-800 bg-[#09090b] shadow-2xl animate-in zoom-in-95 duration-200" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-zinc-800 p-4 bg-[#09090b]">
                    <h2 className="text-lg font-semibold text-white">Edit Profile</h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-6 bg-[#09090b]">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        <div className="flex flex-col items-center gap-4">
                            <div 
                                className="relative group cursor-pointer w-24 h-24" 
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Avatar className="w-full h-full border-2 border-zinc-700 group-hover:border-white transition-colors">
                                    <AvatarImage src={previewUrl || ""} className="object-cover" />
                                    <AvatarFallback className="text-2xl bg-zinc-800 text-zinc-400">
                                        {user.email?.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="h-8 w-8 text-white" />
                                </div>
                            </div>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                            <p className="text-xs text-zinc-500">Click image to upload new avatar</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Display Name</label>
                            <Input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 focus-visible:ring-offset-0"
                                placeholder="Enter your display name"
                            />
                        </div>

                        <div className="flex items-center justify-between pt-4 mt-2 border-t border-zinc-800/50">
                            <div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-zinc-500 hover:text-red-400 hover:bg-zinc-800/50 px-2 h-8"
                                    onClick={handleResetToDefault}
                                    disabled={isLoading}
                                >
                                    Reset to Default
                                </Button>
                            </div>

                            <div className="flex gap-3">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={onClose} 
                                    className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                                    disabled={isLoading}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="submit" 
                                    className="bg-white text-black hover:bg-zinc-200" 
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}