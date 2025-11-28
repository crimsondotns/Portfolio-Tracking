"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { LoginModal } from "@/components/login-modal" 

interface AuthButtonProps {
    isCollapsed?: boolean;
}

export default function AuthButton({ isCollapsed = false }: AuthButtonProps) {
    const router = useRouter()
    
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [user, setUser] = useState<any>(null)
    const [showLoginModal, setShowLoginModal] = useState(false)
    const [showSignOutModal, setShowSignOutModal] = useState(false)
    
    const lastUserId = useRef<string | null>(null)

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setUser(session?.user || null)
            if (session?.user) lastUserId.current = session.user.id
        }
        checkUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUserId = session?.user?.id || null
            
            if (currentUserId !== lastUserId.current) {
                lastUserId.current = currentUserId
                setUser(session?.user || null)
                router.refresh()
            }

            if (_event === 'SIGNED_IN' || _event === 'PASSWORD_RECOVERY') {
                setShowLoginModal(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [supabase, router])

    // --- Actions ---

    const handleGoogleLogin = async () => {
        const redirectTo = `${window.location.origin}/auth/callback`
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: redirectTo,
                queryParams: { access_type: 'offline', prompt: 'consent' },
            },
        })
    }

    const handlePasswordLogin = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        
        if (error) {
            if (error.message === "Invalid login credentials") {
                toast.error("Login Failed", {
                    description: "Invalid email or password." 
                })
            } 
            else if (error.message.includes("Email not confirmed")) {
                toast.error("Login Failed", {
                    description: "Please confirm your email address before logging in."
                })
            }
            else {
                toast.error("Login Failed", {
                    description: error.message
                })
            }
            return { error }
        }

        toast.success("Welcome back!", {
            description: "Signed in successfully."
        })

        return { data, error: null }
    }

    const handleRegister = async (email: string, password: string, username: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: username, 
                }
            }
        })
        
        if (error) {
            toast.error("Registration Failed", {
                description: error.message
            })
            return { error }
        }
        return { data, error: null }
    }

    const handleForgotPassword = async (email: string) => {
        const redirectTo = `${window.location.origin}/auth/update-password`
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
        })
        
        if (error) {
            toast.error("Failed to send reset link", {
                description: error.message
            })
            return { error }
        }
        return { data, error: null }
    }

    const confirmLogout = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) console.warn("Logout warning:", error.message)
        
        setUser(null)
        lastUserId.current = null
        setShowSignOutModal(false)
        router.refresh()
        toast.success("Signed out successfully")
    }

    // --- Render UI ---

    if (user) {
        return (
            <>
                <div className={cn(
                    "flex items-center transition-all w-full",
                    isCollapsed ? "flex-col justify-center px-0 gap-3" : "px-2 gap-2"
                )}>
                    <Avatar className="h-8 w-8 border border-zinc-700">
                        <AvatarImage src={user.user_metadata?.avatar_url} />
                        <AvatarFallback>{user.email?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    {!isCollapsed && (
                        <div className="flex-1 overflow-hidden hidden md:block">
                            <p className="text-sm font-medium text-white truncate">
                                {user.user_metadata?.full_name || user.email}
                            </p>
                            <button 
                                onClick={() => setShowSignOutModal(true)} 
                                className="text-xs text-zinc-500 hover:text-white transition-colors text-left"
                            >
                                Sign Out
                            </button>
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSignOutModal(true)}
                        className={cn("text-zinc-400 hover:text-white hover:bg-zinc-800", !isCollapsed && "md:hidden")}
                        title="Sign Out"
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>

                {showSignOutModal && typeof document !== 'undefined' && createPortal(
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
                        onClick={() => setShowSignOutModal(false)}
                    >
                        <div 
                            className="relative w-full max-w-sm p-6 rounded-lg border border-zinc-800 bg-[#09090b] shadow-2xl animate-in zoom-in-95" 
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold text-white mb-2">Sign Out</h3>
                            <p className="text-sm text-zinc-400 mb-6">Are you sure you want to sign out?</p>
                            <div className="flex justify-end gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowSignOutModal(false)} 
                                    className="border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={confirmLogout} 
                                    className="bg-white text-black hover:bg-zinc-200"
                                >
                                    Confirm
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </>
        )
    }

    return (
        <>
            <Button
                onClick={() => setShowLoginModal(true)}
                className={cn(
                    "bg-white text-black hover:bg-zinc-200 transition-all",
                    isCollapsed ? "w-9 h-9 p-0 rounded-full justify-center" : "w-full gap-2"
                )}
                title="Sign In"
            >
                <LogOut className="h-4 w-4 rotate-180" />
                {!isCollapsed && <span>Sign In</span>}
            </Button>

            <LoginModal 
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                onGoogleLogin={handleGoogleLogin}
                onPasswordLogin={handlePasswordLogin}
                onRegister={handleRegister}
                onForgotPassword={handleForgotPassword}
            />
        </>
    )
}