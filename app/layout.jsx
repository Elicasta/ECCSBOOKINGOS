import './globals.css';

export const metadata = {
  title: 'EC Booking OS',
  description: 'Inquiry to booking operating system for EC Creative Studios.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
