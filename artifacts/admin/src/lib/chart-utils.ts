export const CHART_COLORS = {
  primary: "#458cca",
  secondary: "#16a34a",
  accent: "#f59e0b",
  danger: "#dc2626",
  muted: "#94a3b8",
};

export function getTooltipStyle(isRtl: boolean) {
  return {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    direction: (isRtl ? "rtl" : "ltr") as "rtl" | "ltr",
    textAlign: (isRtl ? "right" : "left") as "right" | "left",
  };
}

export const tooltipStyle = getTooltipStyle(false);

export function rtlAxisProps(isRtl: boolean) {
  return {
    xAxis: { reversed: isRtl },
    yAxis: { orientation: (isRtl ? "right" : "left") as "left" | "right" },
  };
}
