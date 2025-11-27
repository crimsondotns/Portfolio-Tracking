"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation" // ✅ 1. เพิ่ม import useRouter
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Mail, X, Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface AuthButtonProps {
    isCollapsed?: boolean;
}

export default function AuthButton({ isCollapsed = false }: AuthButtonProps) {
    const router = useRouter() // ✅ 2. เรียกใช้ Hook
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [user, setUser] = useState<any>(null)

    // Modal States
    const [showLoginModal, setShowLoginModal] = useState(false)
    const [showSignOutModal, setShowSignOutModal] = useState(false)

    // Login Form States
    const [email, setEmail] = useState("")
    const [otpToken, setOtpToken] = useState("")
    const [step, setStep] = useState<'email' | 'verify'>('email')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

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
            if (_event === 'SIGNED_IN' && currentUserId === lastUserId.current) return

            lastUserId.current = currentUserId
            setUser(session?.user || null)

            if (_event === 'SIGNED_IN') {
                toast.success("Login confirmed!")
                setShowLoginModal(false)
                router.refresh()
            }
        })

        return () => subscription.unsubscribe()
    }, [supabase, router])

    // Google Login
    const handleGoogleLogin = async () => {
        setLoading(true)
        const redirectTo = `${window.location.origin}/auth/callback`
        console.log("🚀 Logging in with Google, redirecting to:", redirectTo)

        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: redirectTo,
                queryParams: { access_type: 'offline', prompt: 'consent' },
            },
        })
    }

    // Send OTP
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)
        const redirectTo = `${window.location.origin}/auth/callback`

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: redirectTo },
        })

        if (error) {
            setMessage("Error: " + error.message)
            toast.error(error.message)
        } else {
            const msg = "OTP sent! Check your email."
            setMessage(`✅ ${msg}`)
            toast.success(msg)
            setStep('verify')
        }
        setLoading(false)
    }

    // Verify OTP
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)
        const { error } = await supabase.auth.verifyOtp({ email, token: otpToken, type: 'email' })
        if (error) {
            setMessage("Error: " + error.message)
            toast.error(error.message)
            setLoading(false)
        } else {
            toast.success("Verified successfully!")
        }
    }

    // ✅ 3. ฟังก์ชัน Confirm Logout (ฉบับแก้ไข: บังคับออกทุกกรณี)
    const confirmLogout = async () => {
        // 1. พยายามแจ้ง Server ให้ Logout (แต่ไม่สน error)
        const { error } = await supabase.auth.signOut()

        if (error) {
            console.warn("Logout error (session likely expired):", error.message)
        }

        // 2. บังคับเคลียร์ค่าหน้าบ้านทันที (Force Clear)
        setUser(null)
        setShowSignOutModal(false)

        // 3. รีเฟรชหน้าจอเพื่อเคลียร์ข้อมูลค้าง เปลี่ยนจาก router.refresh() 
        window.location.reload()
    }

    // --- Render ---

    if (user) {
        return (
            <>
                <div className={cn(
                    "flex items-center transition-all w-full",
                    // ✅ ปรับ gap-4 ตรงนี้เพื่อให้ไอคอนห่างจาก Avatar มากขึ้นตอนพับจอ
                    isCollapsed ? "flex-col justify-center px-0 gap-3" : "px-2 gap-2"
                )}>
                    <Avatar className="h-8 w-8 border border-zinc-700">
                        <AvatarImage src={user.user_metadata?.avatar_url} />
                        <AvatarFallback>{user.email?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    {!isCollapsed && (
                        <div className="flex-1 overflow-hidden hidden md:block">
                            <p className="text-sm font-medium text-white truncate">
                                {user.user_metadata?.full_name || "User"}
                            </p>
                            <button onClick={() => setShowSignOutModal(true)} className="text-xs text-zinc-500 hover:text-white transition-colors text-left">
                                Sign Out
                            </button>
                        </div>
                    )}

                    {/* ปุ่ม Logout: แสดงเฉพาะตอน Mobile หรือตอนพับจอ */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSignOutModal(true)}
                        className={cn("text-zinc-400 hover:text-white hover:bg-zinc-800", !isCollapsed && "md:hidden")}
                        title="Sign Out"
                    >
                        <LogOut className="h-4 w-4 mb-5" />
                    </Button>
                </div>

                {/* Sign Out Modal (Portal) */}
                {showSignOutModal && typeof document !== 'undefined' && createPortal(
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
                        onClick={() => setShowSignOutModal(false)}
                    >
                        <div
                            className="relative w-full max-w-sm p-6 rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl animate-in zoom-in-95"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold text-white mb-2">Sign Out</h3>
                            <p className="text-sm text-zinc-400 mb-6">Are you sure you want to sign out?</p>
                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setShowSignOutModal(false)} className="border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white">
                                    Cancel
                                </Button>
                                <Button onClick={confirmLogout} className="bg-white text-black hover:bg-zinc-200">
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
            {/* ปุ่ม Sign In */}
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

            {/* Login Modal (Portal) */}
            {showLoginModal && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
                    onClick={() => setShowLoginModal(false)}
                >
                    <div
                        className="relative w-full max-w-md animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={() => setShowLoginModal(false)} className="absolute right-4 top-4 z-10 text-zinc-400 hover:text-white">
                            <X className="h-4 w-4" />
                        </button>

                        <Card className="border-zinc-800 bg-zinc-950 text-zinc-50 shadow-lg">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-2xl font-bold tracking-tight">
                                    {step === 'email' ? 'Sign in' : 'Verify OTP'}
                                </CardTitle>
                                <CardDescription className="text-zinc-400">
                                    {step === 'email' ? 'Choose your preferred sign in method' : `Enter the code sent to ${email}`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                {step === 'email' ? (
                                    <>
                                        <Button variant="outline" className="w-full border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white" onClick={handleGoogleLogin} disabled={loading}>
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                                                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                            )}
                                            Continue with Google
                                        </Button>
                                        <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-800" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-zinc-950 px-2 text-zinc-500">Or continue with</span></div></div>
                                        <form onSubmit={handleSendOtp} className="grid gap-2">
                                            <Input id="email" placeholder="name@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-zinc-900 border-zinc-800 text-white" required disabled={loading} />
                                            <Button disabled={loading} className="w-full bg-white text-black hover:bg-zinc-200">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Mail className="mr-2 h-4 w-4" /> Email</Button>
                                        </form>
                                    </>
                                ) : (
                                    <>
                                        <form onSubmit={handleVerifyOtp} className="grid gap-2">
                                            <Input id="otp" placeholder="Enter 6-digit code" type="text" value={otpToken} onChange={(e) => setOtpToken(e.target.value)} className="bg-zinc-900 border-zinc-800 text-white text-center tracking-widest text-lg" required disabled={loading} maxLength={6} />
                                            <Button disabled={loading} className="w-full bg-white text-black hover:bg-zinc-200">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify Code</Button>
                                        </form>
                                        <Button variant="ghost" onClick={() => setStep('email')} disabled={loading} className="w-full text-zinc-400 hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                                    </>
                                )}
                                {message && <p className={`text-sm text-center ${message.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}
                            </CardContent>
                        </Card>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
