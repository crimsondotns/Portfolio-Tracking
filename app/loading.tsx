import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex min-h-screen w-full flex-col md:flex-row bg-[#09090b]">
            {/* Sidebar Skeleton */}
            <div className="hidden md:block w-64 border-r border-white/10 p-6 space-y-6">
                <Skeleton className="h-8 w-32 bg-zinc-900" />
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full bg-zinc-900" />
                    <Skeleton className="h-10 w-full bg-zinc-900" />
                    <Skeleton className="h-10 w-full bg-zinc-900" />
                </div>
            </div>

            {/* Main Content Skeleton */}
            <div className="flex-1 p-4 md:p-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48 bg-zinc-900" />
                        <Skeleton className="h-4 w-64 bg-zinc-900" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-64 bg-zinc-900" />
                        <Skeleton className="h-10 w-10 bg-zinc-900" />
                        <Skeleton className="h-10 w-32 bg-zinc-900" />
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-32 bg-zinc-900" />
                    <Skeleton className="h-32 bg-zinc-900" />
                    <Skeleton className="h-32 bg-zinc-900" />
                </div>

                {/* Table Skeleton */}
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full bg-zinc-900" />
                    <Skeleton className="h-16 w-full bg-zinc-900" />
                    <Skeleton className="h-16 w-full bg-zinc-900" />
                    <Skeleton className="h-16 w-full bg-zinc-900" />
                </div>
            </div>
        </div>
    );
}
