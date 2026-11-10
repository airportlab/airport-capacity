interface PlantaJanelaProps {
  title: string;
  imageUrl: string;
  onClose: () => void;
}

export function PlantaJanela({ title, imageUrl, onClose }: PlantaJanelaProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="panel modal modal-planta"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planta-janela-titulo"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="planta-janela-titulo">{title}</h2>
        <img
          className="planta-desenho"
          src={imageUrl}
          alt={`Desenho da planta de ${title}`}
        />
        <div className="actions modal-actions">
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
