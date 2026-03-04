import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MOSAI 高保真流程原型（Next.js）',
  description: '并行重构版：不影响现有静态原型进度'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

