// Fondo compartido: grid de puntos + línea de luz superior + blobs a la deriva
export function BackgroundFX() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="fx-grid absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
      <div className="fx-blob fx-blob-a fx-drift-a" />
      <div className="fx-blob fx-blob-b fx-drift-b" />
      <div className="fx-blob fx-blob-c fx-drift-c" />
    </div>
  )
}
