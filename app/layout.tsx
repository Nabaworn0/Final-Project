import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "CED Teaching Assessment | FTE KMUTNB";
const description = "ระบบสาธิตสำหรับอัปโหลดแผนและเปรียบเทียบคลิปฝึกสอนกับแผนการสอน สำหรับสาขาคอมพิวเตอร์ศึกษา คณะครุศาสตร์อุตสาหกรรม มจพ.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  return { title, description, icons: { icon: "/favicon.svg" }, openGraph: { title, description, type: "website", images: [{ url: imageUrl, width: 1747, height: 909, alt: "CED Teaching Assessment" }] }, twitter: { card: "summary_large_image", title, description, images: [imageUrl] } };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
