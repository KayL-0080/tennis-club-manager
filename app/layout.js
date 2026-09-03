// app/layout.js
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata = {
  title: 'Tennis Match - 테친회',
  description: 'NTRP 밸런스를 맞추고 중복 페어를 최소화하는 테니스 대진표 자동 생성 서비스',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
