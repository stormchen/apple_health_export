import { Outfit, DM_Sans } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Layout/Sidebar";

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "HealthLens — 健康資料分析",
  description:
    "Apple Health 資料視覺化儀表板 — 追蹤您的步數、心率、睡眠及活動趨勢",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW" className={`${outfit.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="app-shell">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
