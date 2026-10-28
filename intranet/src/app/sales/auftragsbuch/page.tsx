import type { Metadata } from "next";
import { OrderBook } from "@/components/sales/orderbook";

export const metadata: Metadata = { title: "Auftragsbuch" };

export default function OrderBookPage() {
  return <OrderBook />;
}
