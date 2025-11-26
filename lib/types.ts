export interface Token {
    symbol: string;
    name: string;
    avatarUrl?: string;
    network: string;
    address?: string;
    chartUrl?: string;
}

export interface Position {
    id: string;
    token: Token;
    price: number;
    quantity: number;
    invested: number;
    value: number;
    buyPrice: number;
    pnlPercent: number;
    portfolioName: string;
    sparkline?: string | number[];
}

export interface Portfolio {
    id: string;
    name: string;
    positions: Position[];
}
