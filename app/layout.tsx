import type {Metadata} from "next";
import {Noto_Sans_SC,Space_Grotesk} from "next/font/google";
import {headers} from "next/headers";
import "./globals.css";
import "./batch.css";
const sans=Noto_Sans_SC({variable:"--font-sans",subsets:["latin"],weight:["400","500","600","700","900"]});
const display=Space_Grotesk({variable:"--font-display",subsets:["latin"]});
export async function generateMetadata():Promise<Metadata>{const h=await headers(),host=h.get("x-forwarded-host")??h.get("host")??"localhost:3000",protocol=h.get("x-forwarded-proto")??(host.startsWith("localhost")?"http":"https"),image=`${protocol}://${host}/og.png`;return{title:"角纹 · 九宫纹理智能提取",description:"自动裁除图片中心纯色区域，保留最小可用的四角九宫纹理。",openGraph:{title:"角纹 · 九宫纹理智能提取",description:"留下四角，减掉多余。",images:[image]},twitter:{card:"summary_large_image",title:"角纹 · 九宫纹理智能提取",description:"留下四角，减掉多余。",images:[image]}}}
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body className={`${sans.variable} ${display.variable}`}>{children}</body></html>}
