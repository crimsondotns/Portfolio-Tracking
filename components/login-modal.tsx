"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom"; // ✅ 1. เพิ่ม import createPortal
import { X, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoogleLogin: () => void;
    onPasswordLogin: (email: string, pass: string) => Promise<{ error: any }>;
    onRegister: (email: string, pass: string, username: string) => Promise<{ error: any }>;
    onForgotPassword: (email: string) => Promise<{ error: any }>;
}

export function LoginModal({ 
    isOpen, 
    onClose, 
    onGoogleLogin,
    onPasswordLogin,
    onRegister,
    onForgotPassword
}: LoginModalProps) {
    const [view, setView] = useState<'select' | 'login' | 'register' | 'forgot'>('select');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    // ✅ 2. เพิ่ม state เช็คว่า mount บน client หรือยัง (กัน error ตอน SSR)
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // ถ้ายังไม่เปิด, ยังไม่ mount, หรือไม่มี document ให้ return null
    if (!isOpen || !mounted || typeof document === 'undefined') return null;

    const resetForm = () => {
        setView('select');
        setEmail("");
        setPassword("");
        setUsername("");
        setIsLoading(false);
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const { error } = await onPasswordLogin(email, password);
        setIsLoading(false);
        if (!error) {
            onClose();
            resetForm();
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const { error } = await onRegister(email, password, username);
        setIsLoading(false);
        if (!error) {
            toast.success("Account created! Please check your email to confirm.");
            onClose();
            resetForm();
        }
    };

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const { error } = await onForgotPassword(email);
        setIsLoading(false);
        if (!error) {
            toast.success("Password reset email sent!");
            setView('login');
        }
    };

    // ✅ 3. ใช้ createPortal ครอบทั้งหมด แล้วส่งไปที่ document.body
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="relative w-full max-w-md mx-4 overflow-hidden rounded-lg border border-zinc-800 bg-[#09090b] shadow-2xl animate-in zoom-in-95 duration-200" 
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 p-4 bg-[#09090b]">
                    <h2 className="text-lg font-semibold text-white">
                        {view === 'select' && 'Welcome'}
                        {view === 'login' && 'Sign In'}
                        {view === 'register' && 'Create Account'}
                        {view === 'forgot' && 'Reset Password'}
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 bg-[#09090b]">
                    {view === 'select' ? (
                        <div className="flex flex-col gap-3">
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-3 h-12 text-base font-normal border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white"
                                onClick={onGoogleLogin}
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                Continue with Google
                            </Button>

                            <div className="relative my-2">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-zinc-800" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-[#09090b] px-2 text-zinc-500">Or with email</span>
                                </div>
                            </div>

                            <Button
                                className="w-full justify-start gap-3 h-12 text-base font-normal bg-white text-black hover:bg-zinc-200 border-none"
                                onClick={() => setView('login')}
                            >
                                <Mail className="h-5 w-5" />
                                Sign In with Password
                            </Button>
                            
                            <Button
                                variant="ghost"
                                className="w-full text-zinc-400 hover:text-white"
                                onClick={() => setView('register')}
                            >
                                No account? Sign Up
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {view === 'login' && (
                                <form onSubmit={handleLoginSubmit} className="space-y-4">
                                    <Input
                                        type="email"
                                        placeholder="Email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
                                        required
                                    />
                                    <Input
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
                                        required
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setView('forgot')}
                                            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                    <Button type="submit" className="w-full bg-white text-black hover:bg-zinc-200" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                                    </Button>
                                </form>
                            )}

                            {view === 'register' && (
                                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                                    <Input
                                        type="text"
                                        placeholder="Username (Display Name)"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
                                        required
                                    />
                                    <Input
                                        type="email"
                                        placeholder="Email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
                                        required
                                    />
                                    <Input
                                        type="password"
                                        placeholder="Password (min 6 chars)"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
                                        required
                                        minLength={6}
                                    />
                                    <Button type="submit" className="w-full bg-white text-black hover:bg-zinc-200" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                                    </Button>
                                </form>
                            )}

                            {view === 'forgot' && (
                                <form onSubmit={handleForgotSubmit} className="space-y-4">
                                    <p className="text-sm text-zinc-400">
                                        Enter your email to receive a password reset link.
                                    </p>
                                    <Input
                                        type="email"
                                        placeholder="Email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
                                        required
                                    />
                                    <Button type="submit" className="w-full bg-white text-black hover:bg-zinc-200" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
                                    </Button>
                                </form>
                            )}

                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-zinc-400 hover:text-white mt-2"
                                onClick={resetForm}
                                disabled={isLoading}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body // 👈 ส่งไป render ที่ body โดยตรง ป้องกันเรื่อง z-index ซ้อนทับ
    );
}