import type { Metadata } from 'next';
import './globals.css';
import './portal.css';
export const metadata: Metadata={title:'Lavindu Maneth | Maths, made clear',description:'A clearer way to learn mathematics. Explore the Lavindu Maneth learning platform demo.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
