import "./globals.css";

export const metadata = {
  title: "Stowarzyszenie Spełniaj Marzenia",
  description: "Oficjalna strona Stowarzyszenia Spełniaj Marzenia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
