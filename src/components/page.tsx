// Page shell for screens outside a community (sign-in, join, invite…): centred, with the brand on top.
export default function Page({ children, brand = true }: { children: React.ReactNode; brand?: boolean }) {
  return (
    <main className="page-narrow" style={{ paddingTop: 36 }}>
      {brand && (
        <div className="brand" style={{ marginBottom: 22 }}>
          <span className="brand-mark" aria-hidden>Z</span>
          <span className="brand-name">Zist Community</span>
        </div>
      )}
      {children}
    </main>
  );
}
