"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, useRef, useMemo, ReactNode, useCallback } from "react";
import { Portfolio, Position } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Globe, Wallet, ChevronLeft, ChevronRight, Copy, ChevronUp, ChevronDown, List, LayoutGrid, ChevronsUpDown, Triangle, MoreVertical, Trash2, BarChart2, Eye, EyeOff, Fuel, Gauge, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/ui/sparkline";
import { createBrowserClient } from "@supabase/ssr"; // ✅ ใช้ createBrowserClient เพื่อจัดการ Cookies อัตโนมัติ
import AuthButton from "@/components/ui/AuthButton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

// --- Helper Function for Price Formatting ---
const formatCryptoPrice = (price: number) => {
    if (price === 0) return "$0.00";
    if (price >= 1) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
    if (price >= 0.0001) {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(price);
    }
    const priceStr = price.toFixed(20).replace(/0+$/, '');
    const match = priceStr.match(/\.0+/);
    if (match) {
        const zeroCount = match[0].length - 1;
        const significantDigits = priceStr.substring(match[0].length + 1).substring(0, 4);
        const subscripts: { [key: number]: string } = { 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', 10: '₁₀', 11: '₁₁', 12: '₁₂' };
        if (subscripts[zeroCount]) {
            return (<span>$0.0<span className="text-[0.7em] opacity-80">{zeroCount}</span>{significantDigits}</span>);
        }
    }
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 8 }).format(price);
};

interface PortfolioDashboardShellProps {
    portfolios: Portfolio[];
}

export function PortfolioDashboardShell({ portfolios: initialPortfolios }: PortfolioDashboardShellProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // ✅ สร้าง Supabase Client สำหรับ Client Component
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // ✅ ใช้ State เก็บข้อมูลแทน Props (เพื่อให้เราอัปเดตเองได้โดยไม่ต้องรีเฟรชหน้า)
    const [portfolios, setPortfolios] = useState<Portfolio[]>(initialPortfolios);

    const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(initialPortfolios[0]?.id || "all");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Position | 'token', direction: 'desc' | 'asc' } | null>({ key: 'pnlPercent', direction: 'desc' });
    const [visibleCount, setVisibleCount] = useState(50);
    const mobileTarget = useRef<HTMLDivElement>(null);
    const desktopTarget = useRef<HTMLTableRowElement>(null);
    const [user, setUser] = useState<any>(null);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [isPrivacyMode, setIsPrivacyMode] = useState(false);
    const [fngIndex, setFngIndex] = useState<{ value: string, value_classification: string } | null>(null);
    const [gasPrice, setGasPrice] = useState<number | null>(null);

    // ✅ ฟังก์ชันดึงข้อมูลฝั่ง Client (Client-Side Fetching)
    // ไม่กิน Quota Vercel Server Function เพราะยิงตรงไป Supabase
    const fetchClientData = useCallback(async () => {
        const { data, error } = await supabase.from('positions').select('*');

        if (error) {
            console.error("Error fetching data:", error);
            return;
        }

        if (!data) return;

        // Map ข้อมูล (Logic เดียวกับ Server เพื่อให้ข้อมูลหน้าตาเหมือนเดิม)
        const positions: Position[] = data.map((row: any) => {
            const price = Number(row.price_usd) || 0;
            const buyPrice = Number(row.entry_price) || 0;
            const quantity = Number(row.quantity) || 0;
            const invested = Number(row.invested_usd) || 0;
            let pnlPercent = 0;
            if (buyPrice > 0) pnlPercent = ((price - buyPrice) / buyPrice) * 100;
            const currentValue = price * quantity;

            return {
                id: row.id,
                token: {
                    symbol: row.symbol,
                    name: row.name,
                    network: row.network,
                    avatarUrl: (row.avatar_url && !row.avatar_url.includes("missing")) ? row.avatar_url : "https://via.placeholder.com/40",
                    address: row.address,
                    chartUrl: row.chart_url,
                },
                price: price,
                quantity: quantity,
                invested: invested,
                value: currentValue,
                buyPrice: buyPrice,
                pnlPercent: pnlPercent,
                portfolioName: row.portfolio_name || "Uncategorized",
                sparkline: row.sparkline,
            };
        });

        // Group ข้อมูลตาม Portfolio Name
        const portfoliosMap = new Map<string, Position[]>();
        positions.forEach(pos => {
            const name = pos.portfolioName;
            if (!portfoliosMap.has(name)) portfoliosMap.set(name, []);
            portfoliosMap.get(name)?.push(pos);
        });

        const newPortfolios: Portfolio[] = Array.from(portfoliosMap.entries()).map(([name, positions]) => ({
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name: name,
            positions: positions,
        })).sort((a, b) => a.name.localeCompare(b.name));

        setPortfolios(newPortfolios);

        // ถ้า Portfolio ที่เลือกอยู่หายไป (เช่น ลบหมด) ให้ Reset กลับไปอันแรก
        if (selectedPortfolioId !== "all" && !newPortfolios.find(p => p.id === selectedPortfolioId)) {
            // ถ้ามีพอร์ตเหลือ ให้เลือกอันแรก ถ้าไม่มีเลย ให้เป็น all
            if (newPortfolios.length > 0) setSelectedPortfolioId(newPortfolios[0].id);
            else setSelectedPortfolioId("all");
        }

    }, [supabase, selectedPortfolioId]);

    // ✅ Listener สำหรับ Login/Logout แบบ Real-time
    useEffect(() => {
        // เช็ค User ปัจจุบันก่อน
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setUser(session?.user ?? null);
        }
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null);

            if (event === 'SIGNED_IN') {
                // พอ Login ปุ๊บ ดึงข้อมูลใหม่ทันที (Client Fetch) หน้าไม่ขาว ไม่กระพริบ
                fetchClientData();
            } else if (event === 'SIGNED_OUT') {
                // พอ Logout ปุ๊บ เคลียร์ข้อมูล (หรือดึงใหม่แบบ Guest ถ้ามี Public Data)
                setPortfolios([]);
                fetchClientData();
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase, fetchClientData]);

    useEffect(() => {
        // Fetch F&G และ Gas (เหมือนเดิม)
        const fetchFng = async () => {
            try {
                const res = await fetch('https://api.alternative.me/fng/');
                const data = await res.json();
                if (data.data && data.data.length > 0) {
                    setFngIndex(data.data[0]);
                }
            } catch (e) {
                console.error("Failed to fetch F&G Index", e);
            }
        };
        const fetchGas = () => { setGasPrice(Math.floor(Math.random() * 20) + 10); };
        fetchFng();
        fetchGas();
    }, []);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openMenuId && !(event.target as Element).closest('.action-menu-trigger') && !(event.target as Element).closest('.action-menu-content')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    // แก้ไข handleDelete ให้เรียก fetchClientData แทน router.refresh
    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('positions').delete().eq('id', id);

        if (error) {
            toast.error("Failed to delete position: " + error.message);
        } else {
            toast.success("Position deleted successfully");
            setOpenMenuId(null);
            // ✅ เรียก Client Fetch แทน router.refresh() ประหยัด Quota
            fetchClientData();
        }
    };

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(50);
    }, [searchQuery, viewMode, sortConfig, selectedPortfolioId]);

    useEffect(() => {
        if (viewMode === 'card') {
            setSortConfig({ key: 'pnlPercent', direction: 'desc' });
        }
    }, [viewMode]);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 300) {
                setShowBackToTop(true);
            } else {
                setShowBackToTop(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
    };

    const handleRefresh = () => {
        // ✅ ปุ่ม Refresh ก็ดึงผ่าน Client เหมือนกัน
        toast.promise(fetchClientData(), {
            loading: 'Refreshing data...',
            success: 'Data refreshed',
            error: 'Failed to refresh'
        });
    };

    const handleSort = (key: keyof Position | 'token') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const selectedPortfolio = portfolios.find((p) => p.id === selectedPortfolioId) || portfolios[0];

    const filteredPositions = selectedPortfolio?.positions.filter((pos) => {
        const searchLower = searchQuery.toLowerCase();
        const symbol = pos.token.symbol ? pos.token.symbol.toLowerCase() : "";
        const name = pos.token.name ? pos.token.name.toLowerCase() : "";
        const address = pos.token.address ? pos.token.address.toLowerCase() : "";

        return symbol.includes(searchLower) || name.includes(searchLower) || address.includes(searchLower);
    }) || [];

    const sortedPositions = useMemo(() => {
        return [...filteredPositions].sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            let aValue: any = a[key as keyof Position];
            let bValue: any = b[key as keyof Position];

            if (key === 'token') {
                aValue = a.token.symbol;
                bValue = b.token.symbol;
            }

            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredPositions, sortConfig]);

    const visiblePositions = useMemo(() => {
        return sortedPositions.slice(0, visibleCount);
    }, [sortedPositions, visibleCount]);

    // Intersection Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount((prev) => Math.min(prev + 50, sortedPositions.length));
                }
            },
            { threshold: 0.1 }
        );

        const currentMobileTarget = mobileTarget.current;
        const currentDesktopTarget = desktopTarget.current;

        if (viewMode === 'card' && currentMobileTarget) {
            observer.observe(currentMobileTarget);
        } else if (viewMode === 'list' && currentDesktopTarget) {
            observer.observe(currentDesktopTarget);
        }

        return () => {
            if (currentMobileTarget) observer.unobserve(currentMobileTarget);
            if (currentDesktopTarget) observer.unobserve(currentDesktopTarget);
        };
    }, [sortedPositions.length, viewMode, visibleCount]);

    const totalInvested = filteredPositions.reduce((acc, pos) => acc + pos.invested, 0);
    const totalValue = filteredPositions.reduce((acc, pos) => acc + pos.value, 0);
    const totalPnL = totalValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
    };

    const formatPercent = (val: number) => {
        if (val === 0) return "0.00%";
        return `${Math.abs(val).toFixed(2)}%`;
    };

    const getPnLColor = (val: number) => {
        if (val > 0) return "text-emerald-500";
        if (val < 0) return "text-rose-500";
        return "text-zinc-400"; // Neutral color
    };

    const formatPrivacy = (val: string | ReactNode) => {
        return isPrivacyMode ? "••••••" : val;
    };

    return (
        <div className="flex min-h-screen w-full flex-col md:flex-row bg-[#09090b] text-zinc-100 font-sans relative">

            {/* Mobile Header */}
            <div className="md:hidden flex-none flex flex-col gap-4 p-4 border-b border-white/10 bg-[#09090b]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-white">
                        <Wallet className="h-5 w-5" />
                        <span>Portfolio</span>
                    </div>

                    {/* Mobile Widgets */}
                    <div className="flex items-center gap-3 ml-auto mr-2">
                        {fngIndex && (
                            <div className="flex items-center gap-1 bg-zinc-900/50 rounded px-2 py-1 border border-white/5">
                                <Gauge className="h-3 w-3 text-zinc-400" />
                                <span className={cn("text-xs font-bold", Number(fngIndex.value) > 50 ? "text-emerald-500" : "text-rose-500")}>
                                    {fngIndex.value}
                                </span>
                            </div>
                        )}
                        {gasPrice && (
                            <div className="flex items-center gap-1 bg-zinc-900/50 rounded px-2 py-1 border border-white/5">
                                <Fuel className="h-3 w-3 text-zinc-400" />
                                <span className="text-xs font-mono text-zinc-300">{gasPrice}</span>
                            </div>
                        )}
                    </div>

                    {/* Auth Button */}
                    <div className="w-fit">
                        <AuthButton />
                    </div>
                </div>
                <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
                    <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-white">
                        <SelectValue placeholder="Select Portfolio" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        {portfolios.map((portfolio) => (
                            <SelectItem key={portfolio.id} value={portfolio.id}>
                                {portfolio.name} <span className="text-zinc-500 ml-2">({portfolio.positions.length})</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Desktop Sidebar (Sticky) */}
            <aside
                className={cn(
                    "hidden md:flex flex-col border-r border-white/10 bg-[#09090b] transition-all duration-300 sticky top-0 h-screen",
                    isCollapsed ? "w-16 items-center py-6" : "w-64 p-6"
                )}
            >
                <div className="flex items-center justify-between mb-6 w-full">
                    {!isCollapsed && <h2 className="text-lg font-semibold tracking-tight text-white">Portfolio</h2>}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="text-zinc-400 hover:text-white ml-auto"
                    >
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                </div>

                <div className="w-full space-y-4">
                    {/* ✅ ปรับปรุงดีไซน์ปุ่มเลือกพอร์ตเป็น Squircle */}
                    {isCollapsed ? (
                        <div className="flex flex-col gap-3 items-center pt-2">
                            <TooltipProvider>
                                {portfolios.map(p => {
                                    const isActive = selectedPortfolioId === p.id;
                                    return (
                                        <Tooltip key={p.id} delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => setSelectedPortfolioId(p.id)}
                                                    className={cn(
                                                        "relative w-10 h-10 flex items-center justify-center text-xs font-bold transition-all duration-200 border",
                                                        "rounded-xl", // ✅ ดีไซน์สี่เหลี่ยมมน (Squircle)
                                                        isActive
                                                            ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.15)] scale-105 z-10" // Active: ขาว + เรืองแสง
                                                            : "bg-zinc-900/40 text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-700" // Inactive: โปร่ง
                                                    )}
                                                >
                                                    {p.name.substring(0, 2).toUpperCase()}

                                                    {/* Active Indicator (จุดเขียว) */}
                                                    {isActive && (
                                                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-[#09090b]"></span>
                                                        </span>
                                                    )}
                                                </button>
                                            </TooltipTrigger>

                                            {/* Tooltip บอกชื่อเต็ม */}
                                            <TooltipContent side="right" sideOffset={10} className="z-[9999] font-medium bg-zinc-950 border-zinc-800 text-zinc-200">
                                                {p.name}
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </TooltipProvider>
                        </div>
                    ) : (
                        <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
                            <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-white focus:ring-zinc-700">
                                <SelectValue placeholder="Select Portfolio" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                {portfolios.map((portfolio) => (
                                    <SelectItem key={portfolio.id} value={portfolio.id}>
                                        {portfolio.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Sidebar Widgets */}
                <div className={cn("mt-auto space-y-3 w-full flex flex-col items-center", "mb-2", isCollapsed ? "items-center mt-4" : "items-stretch mb-4", isCollapsed ? "px-2" : "px-4 py-3")}>
                    <TooltipProvider>

                        {/* Fear & Greed */}
                        {fngIndex && (
                            isCollapsed ? (
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <div className="flex justify-center w-full cursor-help">
                                            <div className={cn("p-2 rounded-lg bg-zinc-900/50 border border-white/5 transition-colors hover:bg-zinc-800", Number(fngIndex.value) > 50 ? "text-emerald-500" : "text-rose-500")}>
                                                <Gauge className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={10} className="bg-zinc-950 border-zinc-800 text-zinc-300 z-[9999]">
                                        <span className={Number(fngIndex.value) > 50 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                                            {fngIndex.value}
                                        </span>{" "}
                                        <span className="text-zinc-500">({fngIndex.value_classification})</span>
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <div className="bg-zinc-900/50 rounded-lg p-3 border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Gauge className="h-4 w-4 text-zinc-400" />
                                        <span className="text-xs font-medium text-zinc-400">Fear & Greed</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={cn("text-lg font-bold", Number(fngIndex.value) > 50 ? "text-emerald-500" : "text-rose-500")}>
                                            {fngIndex.value}
                                        </span>
                                        <span className="text-xs text-zinc-500">{fngIndex.value_classification}</span>
                                    </div>
                                </div>
                            )
                        )}

                        {/* Gas Price */}
                        {gasPrice && (
                            isCollapsed ? (
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <div className="flex justify-center w-full cursor-help">
                                            <div className="p-2 rounded-lg bg-zinc-900/50 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                                                <Fuel className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={10} className="bg-zinc-950 border-zinc-800 text-zinc-300 z-[9999]">
                                        Gas: <span className="font-mono text-white">{gasPrice}</span> Gwei
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <div className="flex items-center justify-between bg-zinc-900/50 rounded-lg p-2 px-3 border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <Fuel className="h-3 w-3 text-zinc-400" />
                                        <span className="text-xs text-zinc-400">Gas</span>
                                    </div>
                                    <span className="text-xs font-mono text-zinc-300">{gasPrice} Gwei</span>
                                </div>
                            )
                        )}
                    </TooltipProvider>
                </div>

                {/* Desktop Auth Button */}
                <div className={cn("pt-2.5 border-t border-white/10", !isCollapsed ? "mt-0" : "mt-auto")}>
                    <div className={cn(isCollapsed ? "flex justify-center" : "")}>
                        <AuthButton isCollapsed={isCollapsed} />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col">

                {/* Content Container */}
                <div className="p-4 md:p-8 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-white">Maharaja888 Portfolio</h1>
                                <button
                                    onClick={() => setIsPrivacyMode(!isPrivacyMode)}
                                    className="text-zinc-500 hover:text-white transition-colors"
                                    title={isPrivacyMode ? "Show Values" : "Hide Values"}
                                >
                                    {isPrivacyMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                            <p className="text-zinc-400 text-sm">Track your crypto assets across all networks</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SummaryCard title="TOTAL INVESTED" value={formatPrivacy(formatCurrency(totalInvested))} />
                        <SummaryCard title="CURRENT VALUE" value={formatPrivacy(formatCurrency(totalValue))} highlight />
                        <SummaryCard
                            title="RETURN PERCENTAGE %"
                            value={formatPrivacy(formatCurrency(totalPnL))}
                            subValue={formatPrivacy(formatPercent(totalPnLPercent))}
                            isPnL
                            pnlValue={totalPnL}
                        />
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                                <Input
                                    placeholder="Search tokens..."
                                    className="pl-9 bg-zinc-900 border-zinc-800 focus:ring-0 focus:border-zinc-700 text-white placeholder:text-zinc-600"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white"
                                onClick={handleRefresh}
                                disabled={isPending}
                            >
                                <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                            </Button>
                        </div>

                        <div className="flex bg-zinc-900 rounded-md border border-zinc-800 p-1 self-end md:self-auto">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-8 w-8 p-0", viewMode === 'list' && "bg-zinc-800 text-white")}
                                onClick={() => setViewMode('list')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-8 w-8 p-0", viewMode === 'card' && "bg-zinc-800 text-white")}
                                onClick={() => setViewMode('card')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Content Area: Tables & Cards */}
                    {viewMode === 'list' && (
                        <div className="hidden md:block rounded-lg border border-white/10 bg-zinc-950/50 min-h-[500px]">
                            <Table disableOverflow>
                                <TableHeader className="sticky top-0 z-40 bg-[#09090b] shadow-sm">
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableHead className="text-zinc-400 cursor-pointer" onClick={() => handleSort('token')}>
                                            <div className="flex items-center gap-1">
                                                ASSETS
                                                {sortConfig?.key === 'token' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-center text-zinc-400">SPARKLINE</TableHead>
                                        <TableHead className="text-center text-zinc-400">CHART</TableHead>
                                        <TableHead className="text-center text-zinc-400 cursor-pointer" onClick={() => handleSort('price')}>
                                            <div className="flex items-center justify-center gap-1">
                                                PRICE
                                                {sortConfig?.key === 'price' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-center text-zinc-400 cursor-pointer" onClick={() => handleSort('invested')}>
                                            <div className="flex items-center justify-center gap-1">
                                                INVESTED
                                                {sortConfig?.key === 'invested' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-center text-zinc-400 cursor-pointer" onClick={() => handleSort('value')}>
                                            <div className="flex items-center justify-center gap-1">
                                                VALUE
                                                {sortConfig?.key === 'value' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-center text-zinc-400 cursor-pointer" onClick={() => handleSort('quantity')}>
                                            <div className="flex items-center justify-center gap-1">
                                                HOLDING
                                                {sortConfig?.key === 'quantity' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-center text-zinc-400 cursor-pointer" onClick={() => handleSort('pnlPercent')}>
                                            <div className="flex items-center justify-center gap-1">
                                                RETURN
                                                {sortConfig?.key === 'pnlPercent' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-center text-zinc-400">ACTIONS</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visiblePositions.map((pos) => (
                                        <TableRow key={pos.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 bg-zinc-800">
                                                        <AvatarImage src={pos.token.avatarUrl} />
                                                        <AvatarFallback>{pos.token.symbol.slice(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium text-white">{pos.token.symbol}</div>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <Badge variant="secondary" className="bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border-zinc-800 font-normal text-[10px] px-1.5 py-0 h-5 gap-1">
                                                                <Globe className="h-3 w-3" />
                                                                {pos.token.network}
                                                            </Badge>
                                                            <button
                                                                onClick={() => handleCopy(pos.token.address || pos.token.network)}
                                                                className="hover:text-white transition-colors text-zinc-500"
                                                                title="Copy address"
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {pos.sparkline && <Sparkline data={pos.sparkline} width={100} height={30} />}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {pos.token.chartUrl ? (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                                        onClick={() => window.open(pos.token.chartUrl, '_blank')}
                                                        title="View on Chart"
                                                    >
                                                        <BarChart2 className="h-4 w-4" />
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-zinc-600">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-zinc-300">
                                                {formatPrivacy(formatCryptoPrice(pos.price))}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-zinc-300">{formatPrivacy(formatCurrency(pos.invested))}</TableCell>
                                            <TableCell className={cn("text-center font-mono font-medium", getPnLColor(pos.pnlPercent))}>
                                                <div className="flex items-center justify-center gap-1">
                                                    {pos.pnlPercent > 0 && <Triangle className="h-2 w-2 fill-current" />}
                                                    {pos.pnlPercent < 0 && <Triangle className="h-2 w-2 fill-current rotate-180" />}
                                                    {formatPrivacy(formatCurrency(pos.value))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-zinc-300">{isPrivacyMode ? "••••" : pos.quantity.toLocaleString()}</TableCell>

                                            <TableCell className="text-center">
                                                <div className={cn("font-mono font-medium flex items-center justify-center gap-1", getPnLColor(pos.pnlPercent))}>
                                                    {pos.pnlPercent > 0 && <Triangle className="h-2 w-2 fill-current" />}
                                                    {pos.pnlPercent < 0 && <Triangle className="h-2 w-2 fill-current rotate-180" />}
                                                    {formatPrivacy(formatPercent(pos.pnlPercent))}
                                                </div>
                                                <div className={cn("text-xs font-mono", pos.value - pos.invested >= 0 ? "text-emerald-500/70" : "text-rose-500/70", pos.value - pos.invested === 0 && "text-zinc-500")}>
                                                    {formatPrivacy(formatCurrency(pos.value - pos.invested))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center relative">
                                                <div className="relative inline-block text-left">
                                                    <button
                                                        className="action-menu-trigger text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === pos.id ? null : pos.id);
                                                        }}
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </button>

                                                    {openMenuId === pos.id && (
                                                        <div className="action-menu-content absolute right-0 z-50 mt-2 w-32 origin-top-right rounded-md bg-zinc-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-zinc-800">
                                                            <div className="py-1">
                                                                <button
                                                                    className="flex w-full items-center px-4 py-2 text-sm text-rose-500 hover:bg-zinc-800"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDelete(pos.id);
                                                                    }}
                                                                >
                                                                    <Trash2 className="mr-2 h-3 w-3" />
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {/* Desktop Sentinel */}
                                    {visiblePositions.length < sortedPositions.length && (
                                        <TableRow ref={desktopTarget}>
                                            <TableCell colSpan={9} className="text-center py-4 text-zinc-500">
                                                Loading more...
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {viewMode === 'card' && (
                        <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {visiblePositions.map((pos) => (
                                <PortfolioPositionsMobileCards
                                    key={pos.id}
                                    pos={pos}
                                    formatCurrency={formatCurrency}
                                    formatPercent={formatPercent}
                                    handleCopy={handleCopy}
                                    isPrivacyMode={isPrivacyMode}
                                    formatPrivacy={formatPrivacy}
                                    getPnLColor={getPnLColor}
                                />
                            ))}
                            {visiblePositions.length < sortedPositions.length && (
                                <div ref={mobileTarget} className="col-span-full text-center py-4 text-zinc-500">
                                    Loading more...
                                </div>
                            )}
                        </div>
                    )}

                    <div className="md:hidden space-y-4 pb-20">
                        {visiblePositions.map((pos) => (
                            <PortfolioPositionsMobileCards
                                key={pos.id}
                                pos={pos}
                                formatCurrency={formatCurrency}
                                formatPercent={formatPercent}
                                handleCopy={handleCopy}
                                isPrivacyMode={isPrivacyMode}
                                formatPrivacy={formatPrivacy}
                                getPnLColor={getPnLColor}
                            />
                        ))}
                        {visiblePositions.length < sortedPositions.length && (
                            <div ref={mobileTarget} className="text-center py-4 text-zinc-500">
                                Loading more...
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {showBackToTop && (
                <Button
                    variant="secondary"
                    size="icon"
                    className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10"
                    onClick={scrollToTop}
                >
                    <ArrowUp className="h-5 w-5" />
                </Button>
            )}
        </div>
    );
}

// --- Helper Components ---
interface SummaryCardProps {
    title: string;
    value: ReactNode;
    subValue?: ReactNode;
    highlight?: boolean;
    isPnL?: boolean;
    pnlValue?: number;
}

function SummaryCard({ title, value, subValue, highlight, isPnL, pnlValue }: SummaryCardProps) {
    return (
        <Card className="bg-zinc-950 border-white/10">
            <CardHeader className="flex flex-col items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">{title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
                <div className={cn("text-2xl font-bold font-mono", highlight ? "text-white" : "text-zinc-200", isPnL && (pnlValue !== undefined ? (pnlValue > 0 ? "text-emerald-500" : pnlValue < 0 ? "text-rose-500" : "text-zinc-400") : "text-zinc-200"))}>
                    {value}
                </div>
                {subValue && (
                    <div className={cn("flex items-center gap-1 text-xs font-mono mt-1", isPnL && (pnlValue !== undefined ? (pnlValue > 0 ? "text-emerald-500" : pnlValue < 0 ? "text-rose-500" : "text-zinc-400") : "text-zinc-200"))}>
                        {isPnL && pnlValue !== undefined && (
                            <>
                                {pnlValue > 0 && <Triangle className="h-2 w-2 fill-current" />}
                                {pnlValue < 0 && <Triangle className="h-2 w-2 fill-current rotate-180" />}
                            </>
                        )}
                        {subValue}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PortfolioPositionsMobileCards({
    pos,
    formatCurrency,
    formatPercent,
    handleCopy,
    isPrivacyMode,
    formatPrivacy,
    getPnLColor
}: {
    pos: Position,
    formatCurrency: (v: number) => string,
    formatPercent: (v: number) => string,
    handleCopy: (text: string) => void,
    isPrivacyMode: boolean,
    formatPrivacy: (v: string | ReactNode) => ReactNode,
    getPnLColor: (v: number) => string
}) {
    return (
        <Card className="bg-zinc-950 border-white/10">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 bg-zinc-800">
                            <AvatarImage src={pos.token.avatarUrl} />
                            <AvatarFallback>{pos.token.symbol.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-bold text-white">{pos.token.symbol}</div>
                            <div className="text-xs text-zinc-500">{pos.token.name}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={cn("font-bold font-mono", getPnLColor(pos.pnlPercent))}>
                            {formatPrivacy(formatCurrency(pos.value))}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">{isPrivacyMode ? "••••" : pos.quantity.toLocaleString()} {pos.token.symbol}</div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-zinc-500">PRICE:</span>
                    <span className="text-zinc-300 font-mono">{formatPrivacy(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(pos.price))}</span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border-zinc-800 font-normal text-xs gap-1">
                            <Globe className="h-3 w-3" />
                            {pos.token.network}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-500 hover:text-white"
                            onClick={() => handleCopy(pos.token.address || "")}
                        >
                            <Copy className="h-3 w-3" />
                        </Button>
                        {pos.token.chartUrl && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-500 hover:text-white"
                                onClick={() => window.open(pos.token.chartUrl, '_blank')}
                            >
                                <BarChart2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    <div className={cn("font-mono text-sm font-medium flex items-center gap-1", getPnLColor(pos.pnlPercent))}>
                        {pos.pnlPercent > 0 && <Triangle className="h-2 w-2 fill-current" />}
                        {pos.pnlPercent < 0 && <Triangle className="h-2 w-2 fill-current rotate-180" />}
                        {formatPrivacy(formatPercent(pos.pnlPercent))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
