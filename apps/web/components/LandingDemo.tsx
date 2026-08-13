"use client";

import { ReviewCanvas, type CanvasField, type CanvasPage } from "@/components/ReviewCanvas";

const page: CanvasPage = { imageUrl: "/samples/receipt.png", width: 1024, height: 1536 };

const fields: CanvasField[] = [
  { id: "f0", key: "merchant", label: "Merchant", modelValue: "HILLCREST MARKET", humanValue: null, confidence: 0.99, bounds: { top_left: { x: 180, y: 78 }, bottom_right: { x: 840, y: 150 }, width: 660, height: 72 }, status: "auto" },
  { id: "f1", key: "item_1", label: "ORG BLUEBERRIES", modelValue: "6.99", humanValue: null, confidence: 0.97, bounds: { top_left: { x: 88, y: 430 }, bottom_right: { x: 936, y: 480 }, width: 848, height: 50 }, status: "auto" },
  { id: "f2", key: "item_4", label: "CHICKEN THIGHS", modelValue: "18.47", humanValue: null, confidence: 0.94, bounds: { top_left: { x: 88, y: 604 }, bottom_right: { x: 936, y: 654 }, width: 848, height: 50 }, status: "auto" },
  { id: "f3", key: "item_7", label: "SHARP CHEDDAR", modelValue: "12.50", humanValue: null, confidence: 0.74, bounds: { top_left: { x: 88, y: 778 }, bottom_right: { x: 936, y: 828 }, width: 848, height: 50 }, status: "needs_review" },
  { id: "f4", key: "total", label: "Total", modelValue: "84.20", humanValue: null, confidence: 0.98, bounds: { top_left: { x: 220, y: 1288 }, bottom_right: { x: 800, y: 1352 }, width: 580, height: 64 }, status: "auto" },
];

export function LandingDemo() {
  return <ReviewCanvas page={page} fields={fields} readOnly compact />;
}
