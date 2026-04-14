import './globals.css';

export const metadata = {
  title: 'Códigos de Compra',
  description: 'Gestión de códigos y autorizaciones de compra'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
