import { Portfolio, Position } from "./types";
import { supabase } from "./supabase";

export async function fetchPortfoliosFromSupabase(): Promise<Portfolio[]> {
    const { data, error } = await supabase.from('positions').select('*');

    if (error) {
        console.error("Error fetching positions:", error);
        return [];
    }

    if (!data) {
        return [];
    }

    // Map DB rows to Position objects
    const positions: Position[] = data.map((row: any) => {
        // 1. Safe number conversion
        const price = Number(row.price_usd) || 0;
        const buyPrice = Number(row.entry_price) || 0; // Use entry_price from DB
        const quantity = Number(row.quantity) || 0;
        const invested = Number(row.invested_usd) || 0; // Use invested_usd from DB

        // 2. Calculate PnL %
        let pnlPercent = 0;
        if (buyPrice > 0) {
            pnlPercent = ((price - buyPrice) / buyPrice) * 100;
        }

        // 3. Calculate Current Value
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

    // Group positions by portfolioName
    const portfoliosMap = new Map<string, Position[]>();

    positions.forEach(pos => {
        const name = pos.portfolioName;
        if (!portfoliosMap.has(name)) {
            portfoliosMap.set(name, []);
        }
        portfoliosMap.get(name)?.push(pos);
    });

    // Create Portfolio objects from the map
    const portfolios: Portfolio[] = Array.from(portfoliosMap.entries()).map(([name, positions], index) => ({
        id: name.toLowerCase().replace(/\s+/g, '-'), // Generate ID from name
        name: name,
        positions: positions,
    }));

    // Return portfolios sorted by name
    return portfolios.sort((a, b) => a.name.localeCompare(b.name));
}
