import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = { title: 'ALPHA WITNESS — AI HORIZON', description: 'Trading Intelligence Court for evidence-first market research.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><header className="topbar"><Link href="/" className="brand"><span className="brand-mark">AW</span><span>ALPHA WITNESS<small>BY AI HORIZON</small></span></Link><nav><Link href="/methodology">METHODOLOGY</Link><Link href="/cases/archived-yan-novikov">ARCHIVE</Link></nav></header><main>{children}</main><footer><span>AI HORIZON — WITNESS AI ENGINE</span><span>TRADING INTELLIGENCE COURT · EVIDENCE OVER HYPE</span></footer></body></html> }
